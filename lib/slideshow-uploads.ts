import { randomUUID } from "node:crypto";
import {
  AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand,
  GetObjectCommand, HeadObjectCommand, ListPartsCommand, PutObjectCommand, S3Client, UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";
import { readSlideshowGallery, saveSlideshowGallery, slideshowPrefix, SlideshowError } from "@/lib/slideshow-galleries";
import type { SlideshowItem } from "@/lib/slideshow-types";

const PART_SIZE = 32 * 1024 * 1024;
const ROLES = ["original", "preview", "poster"] as const;
type Role = typeof ROLES[number];
type Asset = { key: string; size: number; contentType: string; uploadId: string };
type Session = { galleryId: string; item: SlideshowItem; expiresAt: number; assets: Record<Role, Asset> };
const status = (error: unknown) => (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;
const bucket = () => getOriginalsBucket();

export async function requireSlideshow(id: string) {
  const record = await readSlideshowGallery(id);
  if (!record) throw new SlideshowError("Galéria sa nenašla.", 404);
  return record;
}
function ensureEditable(state: string) {
  if (state !== "draft" && state !== "archived") throw new SlideshowError("Pred úpravami galériu skry.", 409);
}
function roleOf(value: unknown): Role {
  if (typeof value !== "string" || !ROLES.includes(value as Role)) throw new SlideshowError("Neplatný typ súboru.");
  return value as Role;
}
function keys(galleryId: string, itemId: string) {
  slideshowPrefix(itemId);
  const prefix = `${slideshowPrefix(galleryId)}items/${itemId}/`;
  return { original: `${prefix}original.mp4`, preview: `${prefix}preview.mp4`, poster: `${prefix}poster.jpg` };
}
function sessionKey(galleryId: string, itemId: string) {
  slideshowPrefix(itemId);
  return `${slideshowPrefix(galleryId)}uploads/${itemId}.json`;
}
async function readSession(galleryId: string, itemId: string): Promise<Session> {
  try {
    const response = await getR2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: sessionKey(galleryId, itemId) }));
    if (!response.Body) throw new Error("Chýbajú údaje nahrávania.");
    const session = JSON.parse(await response.Body.transformToString()) as Session;
    const expected = keys(galleryId, itemId);
    if (session?.galleryId !== galleryId || session.item?.id !== itemId ||
      !Number.isFinite(session.expiresAt) || !session.assets ||
      session.item.originalKey !== expected.original || session.item.previewKey !== expected.preview ||
      session.item.posterKey !== expected.poster) throw new Error("Poškodené údaje nahrávania.");
    for (const role of ROLES) {
      const asset = session.assets[role];
      if (!asset || asset.key !== expected[role] || !asset.uploadId ||
        !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > 10 * 1024 ** 3 ||
        asset.contentType !== (role === "poster" ? "image/jpeg" : "video/mp4")) {
        throw new Error("Neplatná cesta alebo údaje súboru.");
      }
    }
    if (session.expiresAt <= Date.now()) throw new SlideshowError("Nahrávanie vypršalo. Vyber súbory znova.", 410);
    return session;
  } catch (error) {
    if (status(error) === 404) throw new SlideshowError("Nahrávanie sa nenašlo.", 404);
    throw error;
  }
}

export async function startSlideshowUpload(galleryId: string, body: Record<string, unknown>) {
  ensureEditable((await requireSlideshow(galleryId)).gallery.status);
  const title = "Klip";
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const priceCents = body.priceCents;
  const durationSeconds = body.durationSeconds;
  if (!title || title.length > 160 || /[\u0000-\u001f\u007f]/.test(title)) throw new SlideshowError("Zadaj názov slideshow.");
  if (!filename || filename.length > 240 || /[\u0000-\u001f\u007f/\\]/.test(filename) || !/\.mp4$/i.test(filename)) {
    throw new SlideshowError("Originál musí byť súbor MP4.");
  }
  if (typeof priceCents !== "number" || !Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 1000000) {
    throw new SlideshowError("Cena musí byť od 0,01 € do 10 000 €.");
  }
  if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 86400) {
    throw new SlideshowError("Neplatná dĺžka slideshow.");
  }
  const sizes = body.sizes as Partial<Record<Role, unknown>> | undefined;
  for (const role of ROLES) {
    const size = sizes?.[role];
    const maximum = role === "original" ? 10 * 1024 ** 3 : role === "preview" ? 2 * 1024 ** 3 : 10 * 1024 ** 2;
    if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 1 || size > maximum) {
      throw new SlideshowError("Vyber originál (do 10 GB), náhľad (do 2 GB) a obrázok JPG (do 10 MB).");
    }
  }
  const id = randomUUID();
  const paths = keys(galleryId, id);
  const item: SlideshowItem = { id, title, filename, priceCents, durationSeconds,
    originalKey: paths.original, previewKey: paths.preview, posterKey: paths.poster,
    size: sizes!.original as number, createdAt: new Date().toISOString() };
  const assets = {} as Record<Role, Asset>;
  try {
    for (const role of ROLES) {
      const contentType = role === "poster" ? "image/jpeg" : "video/mp4";
      const result = await getR2Client().send(new CreateMultipartUploadCommand({
        Bucket: bucket(), Key: paths[role], ContentType: contentType, CacheControl: "private, no-store",
      }));
      if (!result.UploadId) throw new Error("R2 nevrátil ID nahrávania.");
      assets[role] = { key: paths[role], size: sizes![role] as number, contentType, uploadId: result.UploadId };
    }
    ensureEditable((await requireSlideshow(galleryId)).gallery.status);
    const session: Session = { galleryId, item, assets, expiresAt: Date.now() + 86400000 };
    await getR2Client().send(new PutObjectCommand({ Bucket: bucket(), Key: sessionKey(galleryId, id),
      Body: JSON.stringify(session), ContentType: "application/json", CacheControl: "no-store", IfNoneMatch: "*" }));
  } catch (error) {
    await Promise.all(Object.values(assets).map(asset => getR2Client().send(new AbortMultipartUploadCommand({
      Bucket: bucket(), Key: asset.key, UploadId: asset.uploadId,
    })).catch(() => {})));
    throw error;
  }
  return { itemId: id, partSize: PART_SIZE };
}

export async function signSlideshowPart(galleryId: string, itemId: string, roleValue: unknown, partNumber: unknown) {
  ensureEditable((await requireSlideshow(galleryId)).gallery.status);
  const role = roleOf(roleValue);
  const asset = (await readSession(galleryId, itemId)).assets[role];
  if (typeof partNumber !== "number" || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > Math.ceil(asset.size / PART_SIZE)) {
    throw new SlideshowError("Neplatné číslo časti.");
  }
  const signingClient = new S3Client({ region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: getR2Client().config.credentials, requestChecksumCalculation: "WHEN_REQUIRED" });
  return { url: await getSignedUrl(signingClient, new UploadPartCommand({ Bucket: bucket(),
    Key: asset.key, UploadId: asset.uploadId, PartNumber: partNumber }), { expiresIn: 900 }) };
}

async function verifyAsset(asset: Asset) {
  const head = await getR2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: asset.key }));
  if (head.ContentLength !== asset.size || head.ContentType !== asset.contentType) throw new SlideshowError("Veľkosť alebo typ uloženého súboru nesúhlasí.", 409);
  const first = await getR2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: asset.key, Range: "bytes=0-31" }));
  if (!first.Body) throw new Error("Prázdny súbor.");
  const bytes = await first.Body.transformToByteArray();
  const valid = asset.contentType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : Buffer.from(bytes.slice(4, 8)).toString("ascii") === "ftyp";
  if (!valid) throw new SlideshowError("Obsah súboru nezodpovedá MP4 alebo JPG.");
}

export async function completeSlideshowAsset(galleryId: string, itemId: string, roleValue: unknown) {
  ensureEditable((await requireSlideshow(galleryId)).gallery.status);
  const asset = (await readSession(galleryId, itemId)).assets[roleOf(roleValue)];
  let exists = false;
  try { await getR2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: asset.key })); exists = true; }
  catch (error) { if (status(error) !== 404) throw error; }
  if (!exists) {
    const response = await getR2Client().send(new ListPartsCommand({ Bucket: bucket(), Key: asset.key,
      UploadId: asset.uploadId, MaxParts: 1000 }));
    const count = Math.ceil(asset.size / PART_SIZE);
    if (response.IsTruncated || response.Parts?.length !== count) throw new SlideshowError("Súbor ešte nie je celý nahratý.", 409);
    for (let i = 0; i < count; i++) {
      const part = response.Parts[i];
      if (part.PartNumber !== i + 1 || part.Size !== Math.min(PART_SIZE, asset.size - i * PART_SIZE) || !part.ETag) {
        throw new SlideshowError("Nahraté časti nesúhlasia.", 409);
      }
    }
    await getR2Client().send(new CompleteMultipartUploadCommand({ Bucket: bucket(), Key: asset.key,
      UploadId: asset.uploadId, MultipartUpload: { Parts: response.Parts.map(p => ({ PartNumber: p.PartNumber, ETag: p.ETag })) } }));
  }
  await verifyAsset(asset);
  return { ok: true };
}

export async function finishSlideshowUpload(galleryId: string, itemId: string) {
  const initial = await requireSlideshow(galleryId);
  ensureEditable(initial.gallery.status);
  if (initial.gallery.items.some(i => i.id === itemId)) return { ok: true };
  const session = await readSession(galleryId, itemId);
  await Promise.all(ROLES.map(role => verifyAsset(session.assets[role])));
  for (let attempt = 0; attempt < 5; attempt++) {
    const { gallery, etag } = await requireSlideshow(galleryId);
    ensureEditable(gallery.status);
    if (gallery.items.some(i => i.id === itemId)) return { ok: true };
    // Allocate with the same conditional write as the item, preserving numbers after deletion.
    const largest = gallery.items.reduce((value, item) => {
      const match = /^Klip(\d+)$/.exec(item.title);
      return match ? Math.max(value, Number(match[1])) : value;
    }, 0);
    const next = Math.max(gallery.nextClipNumber ?? 1, largest + 1);
    if (!Number.isSafeInteger(next) || next < 1 || next >= Number.MAX_SAFE_INTEGER) {
      throw new SlideshowError("Neplatné číslovanie klipov.", 409);
    }
    const label = `Klip${String(next).padStart(3, "0")}`;
    gallery.nextClipNumber = next + 1;
    gallery.items.push({ ...session.item, title: label, filename: `${label}.mp4` });
    gallery.updatedAt = new Date().toISOString();
    try { await saveSlideshowGallery(gallery, etag); return { ok: true }; }
    catch (error) { if (!(error instanceof SlideshowError) || error.status !== 409 || attempt === 4) throw error; }
  }
  throw new Error("Uloženie slideshow zlyhalo.");
}

export async function abortSlideshowUpload(galleryId: string, itemId: string) {
  const { gallery } = await requireSlideshow(galleryId);
  if (gallery.items.some(i => i.id === itemId)) return { ok: true, saved: true };
  const session = await readSession(galleryId, itemId);
  await Promise.all(ROLES.map(async role => {
    const asset = session.assets[role];
    try { await getR2Client().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: asset.key, UploadId: asset.uploadId })); }
    catch (error) { if (status(error) !== 404) throw error; }
  }));
  // Keep completed files: a concurrent finish may have saved them already.
  return { ok: true };
}

export async function slideshowAdminDetail(galleryId: string) {
  const { gallery } = await requireSlideshow(galleryId);
  const items = await Promise.all(gallery.items.map(async item => {
    const expected = keys(galleryId, item.id);
    if (item.originalKey !== expected.original || item.previewKey !== expected.preview || item.posterKey !== expected.poster) {
      throw new Error("Neplatná cesta slideshow.");
    }
    const signed = async (role: Role) => getSignedUrl(getR2Client(), new GetObjectCommand({
      Bucket: bucket(), Key: expected[role], ResponseCacheControl: "private, no-store", ResponseContentDisposition: "inline",
    }), { expiresIn: 300 });
    const [previewUrl, posterUrl] = await Promise.all([signed("preview"), signed("poster")]);
    return { id: item.id, title: item.title, filename: item.filename, priceCents: item.priceCents,
      durationSeconds: item.durationSeconds, size: item.size, previewUrl, posterUrl };
  }));
  return { id: gallery.id, title: gallery.title, date: gallery.date, status: gallery.status, items };
}
