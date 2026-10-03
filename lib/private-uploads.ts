import { randomUUID } from "node:crypto";
import {
  AbortMultipartUploadCommand, CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand, GetObjectCommand,
  HeadObjectCommand, ListPartsCommand, PutObjectCommand, S3Client, UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";
import { PrivateGalleryError, privateGalleryPrefix, readPrivateGallery, savePrivateGallery } from "@/lib/private-galleries";
import type { PrivateGalleryItem } from "@/lib/media-types";

const PART_SIZE = 32 * 1024 * 1024;
const MAX_SIZE = 10 * 1024 * 1024 * 1024;
const SESSION_MS = 24 * 60 * 60 * 1000;
type Session = { galleryId: string; uploadId: string; item: PrivateGalleryItem; expiresAt: number };
const status = (error: unknown) => (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;
const bucket = () => getOriginalsBucket();

function sessionKey(galleryId: string, itemId: string) {
  // Validate both identifiers before using any user-supplied path.
  privateGalleryPrefix(itemId);
  return `${privateGalleryPrefix(galleryId)}uploads/${itemId}.json`;
}
function ensureDraft(state: string) {
  if (state !== "draft" && state !== "blocked") throw new PrivateGalleryError("Pred nahrávaním súborov galériu zablokuj.", 409);
}
async function readSession(galleryId: string, itemId: string): Promise<Session> {
  try {
    const response = await getR2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: sessionKey(galleryId, itemId) }));
    if (!response.Body) throw new Error("Chýba obsah nahrávania.");
    const session = JSON.parse(await response.Body.transformToString()) as Session;
    const prefix = `${privateGalleryPrefix(galleryId)}files/${itemId}/`;
    if (session.galleryId !== galleryId || session.item.id !== itemId || !session.item.originalKey.startsWith(prefix)) {
      throw new Error("Neplatné údaje nahrávania.");
    }
    if (session.expiresAt <= Date.now()) throw new PrivateGalleryError("Nahrávanie vypršalo. Vyber súbor znova.", 410);
    return session;
  } catch (error) {
    if (status(error) === 404) throw new PrivateGalleryError("Nahrávanie sa nenašlo.", 404);
    throw error;
  }
}

export async function startPrivateUpload(galleryId: string, name: unknown, size: unknown) {
  const { gallery } = await readPrivateGallery(galleryId);
  ensureDraft(gallery.status);
  const filename = typeof name === "string" ? name.trim() : "";
  if (!filename || filename.length > 240 || /[\x00-\x1f\x7f/\\]/.test(filename)) {
    throw new PrivateGalleryError("Neplatný názov súboru.", 400);
  }
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 1 || size > MAX_SIZE) {
    throw new PrivateGalleryError("Súbor musí mať veľkosť od 1 bajtu do 10 GB.", 400);
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  const formats: Record<string, { kind: "photo" | "video"; contentType: string }> = {
    jpg: { kind: "photo", contentType: "image/jpeg" }, jpeg: { kind: "photo", contentType: "image/jpeg" },
    png: { kind: "photo", contentType: "image/png" }, mp4: { kind: "video", contentType: "video/mp4" },
  };
  const format = ext ? formats[ext] : undefined;
  if (!format) throw new PrivateGalleryError("Vyber JPG, JPEG, PNG alebo MP4.", 400);
  const id = randomUUID();
  const item: PrivateGalleryItem = {
    id, ...format, filename, size, originalKey: `${privateGalleryPrefix(galleryId)}files/${id}/original.${ext}`,
    thumbnailKey: null, createdAt: new Date().toISOString(),
  };
  const result = await getR2Client().send(new CreateMultipartUploadCommand({
    Bucket: bucket(), Key: item.originalKey, ContentType: item.contentType, CacheControl: "private, no-store",
  }));
  if (!result.UploadId) throw new Error("R2 nevrátil ID nahrávania.");
  try {
    // A delete/activation may have won while CreateMultipartUpload was in flight.
    ensureDraft((await readPrivateGallery(galleryId)).gallery.status);
    const session: Session = { galleryId, uploadId: result.UploadId, item, expiresAt: Date.now() + SESSION_MS };
    await getR2Client().send(new PutObjectCommand({ Bucket: bucket(), Key: sessionKey(galleryId, id),
      Body: JSON.stringify(session), ContentType: "application/json", CacheControl: "no-store", IfNoneMatch: "*" }));
  } catch (error) {
    await getR2Client().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: item.originalKey, UploadId: result.UploadId })).catch(() => {});
    throw error;
  }
  return { itemId: id, partSize: PART_SIZE, partCount: Math.ceil(size / PART_SIZE) };
}

export async function signPrivatePart(galleryId: string, itemId: string, partNumber: unknown) {
  const [{ gallery }, session] = await Promise.all([readPrivateGallery(galleryId), readSession(galleryId, itemId)]);
  ensureDraft(gallery.status);
  const count = Math.ceil(session.item.size / PART_SIZE);
  if (typeof partNumber !== "number" || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > count) {
    throw new PrivateGalleryError("Neplatné číslo časti súboru.", 400);
  }
  // Without a body, the default SDK checksum would describe an empty part.
  // R2 receives the real bytes directly from the browser; use unsigned payload.
  const signingClient = new S3Client({
    region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: getR2Client().config.credentials, requestChecksumCalculation: "WHEN_REQUIRED",
  });
  const url = await getSignedUrl(signingClient, new UploadPartCommand({
    Bucket: bucket(), Key: session.item.originalKey, UploadId: session.uploadId, PartNumber: partNumber,
  }), { expiresIn: 900 });
  return { url };
}

async function checkFile(session: Session) {
  const response = await getR2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: session.item.originalKey }));
  if (response.ContentLength !== session.item.size || response.ContentType !== session.item.contentType) {
    throw new PrivateGalleryError("Veľkosť alebo typ uloženého súboru nesúhlasí.", 409);
  }
  // Check the actual file signature, not only the filename supplied by the browser.
  const first = await getR2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: session.item.originalKey, Range: "bytes=0-31" }));
  if (!first.Body) throw new Error("Súbor nemá obsah.");
  const bytes = await first.Body.transformToByteArray();
  const valid = session.item.contentType === "image/jpeg"
    ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : session.item.contentType === "image/png"
      ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
      : Buffer.from(bytes.slice(4, 8)).toString("ascii") === "ftyp";
  if (!valid) throw new PrivateGalleryError("Obsah súboru nezodpovedá JPG, PNG alebo MP4. Súbor nebol pridaný.", 400);
}

export async function completePrivateUpload(galleryId: string, itemId: string) {
  const initial = await readPrivateGallery(galleryId);
  ensureDraft(initial.gallery.status);
  if (initial.gallery.removedItemIds?.includes(itemId)) throw new PrivateGalleryError("Súbor bol odstránený.", 410);
  if (initial.gallery.items.some(item => item.id === itemId)) return { ok: true };
  const session = await readSession(galleryId, itemId);
  let completed = false;
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: session.item.originalKey }));
    completed = true; // A retry after an interrupted completion response.
  } catch (error) { if (status(error) !== 404) throw error; }
  if (!completed) {
    const parts = await getR2Client().send(new ListPartsCommand({
      Bucket: bucket(), Key: session.item.originalKey, UploadId: session.uploadId, MaxParts: 1000,
    }));
    const expectedCount = Math.ceil(session.item.size / PART_SIZE);
    if (parts.IsTruncated || parts.Parts?.length !== expectedCount) {
      throw new PrivateGalleryError("Súbor ešte nie je celý nahratý.", 409);
    }
    for (let index = 0; index < expectedCount; index++) {
      const part = parts.Parts[index];
      const expectedSize = Math.min(PART_SIZE, session.item.size - index * PART_SIZE);
      if (part.PartNumber !== index + 1 || part.Size !== expectedSize || !part.ETag) {
        throw new PrivateGalleryError("Nahraté časti súboru nesúhlasia.", 409);
      }
    }
    await getR2Client().send(new CompleteMultipartUploadCommand({
      Bucket: bucket(), Key: session.item.originalKey, UploadId: session.uploadId,
      MultipartUpload: { Parts: parts.Parts.map(part => ({ PartNumber: part.PartNumber, ETag: part.ETag })) },
    }));
  }
  await checkFile(session);
  // Merge only this verified item. ETag prevents overwriting concurrent changes.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { gallery, etag } = await readPrivateGallery(galleryId);
    ensureDraft(gallery.status);
    if (gallery.removedItemIds?.includes(itemId)) throw new PrivateGalleryError("Súbor bol odstránený.", 410);
    if (gallery.items.some(item => item.id === itemId)) return { ok: true };
    gallery.items.push(session.item);
    gallery.updatedAt = new Date().toISOString();
    try {
      await savePrivateGallery(gallery, etag);
      // Retain session for idempotent retries and later gallery cleanup.
      return { ok: true };
    } catch (error) {
      if (!(error instanceof PrivateGalleryError) || error.status !== 409 || attempt === 4) throw error;
    }
  }
  throw new Error("Nahrávanie sa nepodarilo dokončiť.");
}

export async function abortPrivateUpload(galleryId: string, itemId: string) {
  const { gallery } = await readPrivateGallery(galleryId);
  if (gallery.items.some(item => item.id === itemId)) return { ok: true, saved: true };
  const session = await readSession(galleryId, itemId);
  try {
    await getR2Client().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: session.item.originalKey, UploadId: session.uploadId }));
  } catch (error) { if (status(error) !== 404) throw error; }
  // Completed uploads are deliberately retained if the metadata response was uncertain.
  // Do not delete an original that a concurrent completion may have just saved.
  return { ok: true };
}

export async function privateGalleryDetail(galleryId: string) {
  const { gallery } = await readPrivateGallery(galleryId);
  const deleting = gallery.status === "deleted" || gallery.status === "deleting";
  const items = await Promise.all((deleting ? [] : gallery.items).map(async item => {
    const prefix = `${privateGalleryPrefix(galleryId)}files/${item.id}/`;
    privateGalleryPrefix(item.id);
    if (!item.originalKey.startsWith(prefix)) throw new Error("Neplatná cesta k súboru galérie.");
    const url = await getSignedUrl(getR2Client(), new GetObjectCommand({ Bucket: bucket(), Key: item.originalKey,
      ResponseCacheControl: "private, no-store", ResponseContentDisposition: "inline" }), { expiresIn: 300 });
    return { id: item.id, filename: item.filename, kind: item.kind, size: item.size, url };
  }));
  return {
    id: gallery.id, title: gallery.title, customerName: gallery.customerName, status: gallery.status, items,
    activatedAt: gallery.activatedAt, expiresAt: gallery.expiresAt,
    customerPath: gallery.status === "active" && gallery.accessToken && gallery.expiresAt && Date.parse(gallery.expiresAt) > Date.now()
      ? `/private/${gallery.id}#token=${gallery.accessToken}` : null,
    pendingDeletes: (deleting ? [] : gallery.pendingDeletes ?? []).map(item => ({ id: item.id, filename: item.filename })),
  };
}
