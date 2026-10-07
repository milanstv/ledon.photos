import sharp from "sharp";
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand,
  GetObjectCommand, HeadObjectCommand, ListPartsCommand, PutObjectCommand, S3Client, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";
import { PhotoGalleryError, photoGalleryPrefix, requirePhotoGallery, savePhotoGallery } from "@/lib/photo-galleries";

const PART_SIZE = 16 * 1024 * 1024;
const MAX_SIZE = 64 * 1024 * 1024;
const SESSION_MS = 24 * 60 * 60 * 1000;
type Session = { galleryId: string; itemId: string; filename: string; size: number; originalKey: string; uploadId: string; expiresAt: number };
const bucket = () => getOriginalsBucket();
const missing = (e: unknown) => (e as { $metadata?: { httpStatusCode?: number }; name?: string })?.$metadata?.httpStatusCode === 404 || (e as { name?: string })?.name === "NoSuchKey";
const conflict = (e: unknown) => (e as { $metadata?: { httpStatusCode?: number }; name?: string })?.$metadata?.httpStatusCode === 412 || (e as { name?: string })?.name === "PreconditionFailed";
function ensureDraft(status: string) {
  if (status !== "draft") throw new PhotoGalleryError("Nahrávať môžeš iba do konceptu galérie.", 409);
}
function key(galleryId: string, itemId: string) {
  photoGalleryPrefix(itemId);
  return `${photoGalleryPrefix(galleryId)}uploads/${itemId}.json`;
}
async function readSession(galleryId: string, itemId: string): Promise<Session | null> {
  try {
    const response = await getR2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: key(galleryId, itemId) }));
    if (!response.Body) throw new Error("Chýbajú údaje nahrávania.");
    const s = JSON.parse(await response.Body.transformToString()) as Session;
    if (s.galleryId !== galleryId || s.itemId !== itemId || !s.uploadId ||
      s.originalKey !== `${photoGalleryPrefix(galleryId)}files/${itemId}/original.jpg` ||
      !Number.isSafeInteger(s.size) || s.size < 1 || s.size > MAX_SIZE || !Number.isFinite(s.expiresAt))
      throw new Error("Poškodené údaje nahrávania.");
    if (s.expiresAt <= Date.now()) throw new PhotoGalleryError("Nahrávanie vypršalo. Vyber súbor znova.", 410);
    return s;
  } catch (e) { if (missing(e)) return null; throw e; }
}
async function session(galleryId: string, itemId: string) {
  const s = await readSession(galleryId, itemId);
  if (!s) throw new PhotoGalleryError("Nahrávanie sa nenašlo.", 404);
  return s;
}
export async function startPhotoUpload(galleryId: string, itemId: unknown, filename: unknown, size: unknown) {
  const { gallery } = await requirePhotoGallery(galleryId);
  ensureDraft(gallery.status);
  if (typeof itemId !== "string") throw new PhotoGalleryError("Chýba ID nahrávania.");
  photoGalleryPrefix(itemId);
  if (typeof filename !== "string" || !filename.trim() || filename.length > 240 ||
    /[\x00-\x1f\x7f/\\]/.test(filename) || !/\.jpe?g$/i.test(filename))
    throw new PhotoGalleryError("Vyber originálny JPG alebo JPEG s platným názvom.");
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 1 || size > MAX_SIZE)
    throw new PhotoGalleryError("Jeden JPG môže mať najviac 64 MB.");
  const saved = gallery.items.find(i => i.id === itemId);
  if (saved) {
    if (saved.sourceFilename !== filename || saved.size !== size) throw new PhotoGalleryError("ID patrí inému súboru.", 409);
    return { saved: true, itemId, partSize: PART_SIZE, partCount: Math.ceil(size / PART_SIZE) };
  }
  let current = await readSession(galleryId, itemId);
  if (!current) {
    const originalKey = `${photoGalleryPrefix(galleryId)}files/${itemId}/original.jpg`;
    const created = await getR2Client().send(new CreateMultipartUploadCommand({ Bucket: bucket(), Key: originalKey,
      ContentType: "image/jpeg", CacheControl: "private, no-store" }));
    if (!created.UploadId) throw new Error("R2 nevrátil ID prenosu.");
    const candidate: Session = { galleryId, itemId, filename, size, originalKey, uploadId: created.UploadId, expiresAt: Date.now() + SESSION_MS };
    try {
      ensureDraft((await requirePhotoGallery(galleryId)).gallery.status);
      await getR2Client().send(new PutObjectCommand({ Bucket: bucket(), Key: key(galleryId, itemId), Body: JSON.stringify(candidate),
        ContentType: "application/json", CacheControl: "no-store", IfNoneMatch: "*" }));
      current = candidate;
    } catch (e) {
      await getR2Client().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: originalKey, UploadId: created.UploadId })).catch(() => {});
      if (!conflict(e)) throw e;
      current = await session(galleryId, itemId);
    }
  }
  if (current.filename !== filename || current.size !== size) throw new PhotoGalleryError("ID patrí inému súboru.", 409);
  // An interrupted completion can be retried without sending the original again.
  let completed = false;
  try { await getR2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: current.originalKey })); completed = true; }
  catch (e) { if (!missing(e)) throw e; }
  return { itemId, saved: false, completed, partSize: PART_SIZE, partCount: Math.ceil(size / PART_SIZE) };
}
export async function signPhotoPart(galleryId: string, itemId: string, partNumber: unknown) {
  const [{ gallery }, s] = await Promise.all([requirePhotoGallery(galleryId), session(galleryId, itemId)]);
  ensureDraft(gallery.status);
  if (typeof partNumber !== "number" || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > Math.ceil(s.size / PART_SIZE))
    throw new PhotoGalleryError("Neplatné číslo časti.");
  const client = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: getR2Client().config.credentials, requestChecksumCalculation: "WHEN_REQUIRED" });
  const url = await getSignedUrl(client, new UploadPartCommand({ Bucket: bucket(), Key: s.originalKey,
    UploadId: s.uploadId, PartNumber: partNumber }), { expiresIn: 900 });
  return { url };
}
export async function completePhotoUpload(galleryId: string, itemId: string) {
  const initial = await requirePhotoGallery(galleryId); ensureDraft(initial.gallery.status);
  if (initial.gallery.items.some(i => i.id === itemId)) return { ok: true };
  const s = await session(galleryId, itemId);
  let head;
  try { head = await getR2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: s.originalKey })); }
  catch (e) { if (!missing(e)) throw e; }
  if (!head) {
    const result = await getR2Client().send(new ListPartsCommand({ Bucket: bucket(), Key: s.originalKey, UploadId: s.uploadId, MaxParts: 1000 }));
    const count = Math.ceil(s.size / PART_SIZE);
    if (result.IsTruncated || result.Parts?.length !== count) throw new PhotoGalleryError("Súbor ešte nie je celý nahratý.", 409);
    for (let i = 0; i < count; i++) {
      const p = result.Parts[i];
      if (p.PartNumber !== i + 1 || !p.ETag || p.Size !== Math.min(PART_SIZE, s.size - i * PART_SIZE))
        throw new PhotoGalleryError("Nahraté časti súboru nesúhlasia.", 409);
    }
    try {
      await getR2Client().send(new CompleteMultipartUploadCommand({ Bucket: bucket(), Key: s.originalKey, UploadId: s.uploadId,
        MultipartUpload: { Parts: result.Parts.map(p => ({ PartNumber: p.PartNumber, ETag: p.ETag })) } }));
    } catch (e) {
      // Another identical completion may have won; verify the resulting object below.
      try { await getR2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: s.originalKey })); }
      catch { throw e; }
    }
    head = await getR2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: s.originalKey }));
  }
  if (head.ContentLength !== s.size || head.ContentType !== "image/jpeg") throw new PhotoGalleryError("Veľkosť alebo typ JPG nesúhlasí.", 409);
  const response = await getR2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: s.originalKey }));
  if (!response.Body) throw new Error("Chýba obsah JPG.");
  const bytes = await response.Body.transformToByteArray();
  if (bytes.length !== s.size || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
    throw new PhotoGalleryError("Obsah súboru nie je JPG.");
  try {
    const image = sharp(bytes, { limitInputPixels: 100000000, failOn: "error" });
    const m = await image.metadata();
    if (m.format !== "jpeg" || !m.width || !m.height) throw new Error();
    await image.resize(1, 1).toBuffer();
  } catch { throw new PhotoGalleryError("JPG sa nedá načítať alebo prekračuje 100 megapixelov."); }
  for (let attempt = 0; attempt < 5; attempt++) {
    const { gallery, etag } = await requirePhotoGallery(galleryId); ensureDraft(gallery.status);
    if (gallery.items.some(i => i.id === itemId)) return { ok: true };
    if (gallery.items.length >= 5000) throw new PhotoGalleryError("Galéria môže obsahovať najviac 5 000 fotografií.");
    const number = gallery.nextPhotoNumber;
    // Strip prior gallery numbering only from the Canon camera filename pattern.
    // Meaningful custom names such as "vylet-2026" keep their numeric suffix.
    const stem = s.filename.replace(/\.jpe?g$/i, "");
    const camera = stem.match(/^(8F7A\d{4})(?:-\d+)+$/i);
    const base = (camera?.[1] ?? stem).normalize("NFKD").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100) || "foto";
    gallery.items.push({ id: itemId, filename: `${base}-${number}.jpg`, sourceFilename: s.filename,
      customerNumber: number, originalKey: s.originalKey, previewKey: null, socialKey: null,
      takenAt: null, size: s.size, status: "uploaded" });
    gallery.nextPhotoNumber++; gallery.updatedAt = new Date().toISOString();
    try { await savePhotoGallery(gallery, etag); return { ok: true }; }
    catch (e) { if (!(e instanceof PhotoGalleryError) || e.status !== 409 || attempt === 4) throw e; }
  }
  throw new Error("Nahrávanie sa nepodarilo dokončiť.");
}
export async function photoGalleryDetail(galleryId: string) {
  const { gallery } = await requirePhotoGallery(galleryId);
  // Original objects remain private. This stage exposes names and sizes to admin only.
  return { id: gallery.id, title: gallery.title, date: gallery.date, priceCents: gallery.priceCents, status: gallery.status,
    items: gallery.items.map(i => ({ id: i.id, filename: i.filename, sourceFilename: i.sourceFilename, customerNumber: i.customerNumber, size: i.size, status: i.status })) };
}
