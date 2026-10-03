import { randomUUID, timingSafeEqual } from "node:crypto";
import {
  AbortMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand,
  ListMultipartUploadsCommand, ListObjectsV2Command, PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";
import {
  PrivateGalleryError, privateGalleryIdPage, privateGalleryPrefix,
  readPrivateGallery, savePrivateGallery, type PrivateGalleryRecord,
} from "@/lib/private-galleries";

const STATE_KEY = "_private_cleanup/state.json";
const status = (error: unknown) => (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;
const gone = (gallery: PrivateGalleryRecord) => gallery.status === "deleting" || gallery.status === "deleted";
const expired = (gallery: PrivateGalleryRecord) => Boolean(
  (gallery.status === "active" || gallery.status === "blocked")
  && gallery.activatedAt && Number.isFinite(Date.parse(gallery.activatedAt))
  && gallery.expiresAt && Number.isFinite(Date.parse(gallery.expiresAt))
  && Date.parse(gallery.expiresAt) <= Date.now(),
);
type Progress = { ok: true; done: boolean; deletedObjects: number; abortedUploads: number };

// Commit the irreversible state first. Concurrent extension/upload writes lose
// their old ETag and cannot restore customer access or overwrite the tombstone.
async function beginDeletion(galleryId: string, automatic: boolean, confirmation?: unknown) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { gallery, etag } = await readPrivateGallery(galleryId);
    if (gone(gallery)) return true;
    if (automatic && !expired(gallery)) return false;
    if (!automatic && confirmation !== gallery.title) {
      throw new PrivateGalleryError("Pre zmazanie napíš presný názov galérie.", 400);
    }
    const now = new Date().toISOString();
    gallery.status = "deleting";
    gallery.accessToken = null;
    gallery.deletionStartedAt = now;
    gallery.updatedAt = now;
    try { await savePrivateGallery(gallery, etag); return true; }
    catch (error) {
      if (!(error instanceof PrivateGalleryError) || error.status !== 409 || attempt === 4) throw error;
    }
  }
  throw new Error("Mazanie sa nepodarilo začať.");
}

function assertKey(key: string | undefined, prefix: string): asserts key is string {
  if (!key || !key.startsWith(prefix) || key === prefix) {
    throw new Error("R2 vrátil súbor mimo súkromnej galérie. Mazanie bolo zastavené.");
  }
}
async function batch<T>(values: T[], deadline: number, operation: (value: T) => Promise<void>) {
  let processed = 0;
  for (let offset = 0; offset < values.length && Date.now() < deadline; offset += 5) {
    const results = await Promise.allSettled(values.slice(offset, offset + 5).map(operation));
    for (const result of results) {
      if (result.status === "rejected") throw result.reason;
      processed++;
    }
  }
  return processed;
}
async function finishDeletion(galleryId: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { gallery, etag } = await readPrivateGallery(galleryId);
    if (!gone(gallery)) throw new Error("Galéria nemá stav mazania.");
    if (gallery.status === "deleted") return;
    const now = new Date().toISOString();
    // Keep only a minimal tombstone. It stops late upload retries and lets
    // future sweeps remove a delayed R2 write without retaining customer data.
    const tombstone: PrivateGalleryRecord = {
      id: gallery.id, title: "Vymazaná galéria", customerName: "", status: "deleted",
      createdAt: gallery.createdAt, updatedAt: now, activatedAt: null,
      expiresAt: null, deletedAt: now, accessToken: null, items: [],
      deletionStartedAt: gallery.deletionStartedAt,
    };
    try { await savePrivateGallery(tombstone, etag); return; }
    catch (error) {
      if (!(error instanceof PrivateGalleryError) || error.status !== 409 || attempt === 4) throw error;
    }
  }
}

// Each pass has a fixed batch size and time budget. Repeating it is safe.
// Never remove gallery.json: that is the permanent barrier against old writes.
export async function purgePrivateGallery(galleryId: string, deadline = Date.now() + 20_000): Promise<Progress> {
  const { gallery } = await readPrivateGallery(galleryId);
  if (!gone(gallery)) throw new PrivateGalleryError("Galéria ešte nie je označená na zmazanie.", 409);
  const Prefix = privateGalleryPrefix(galleryId);
  const Bucket = getOriginalsBucket();
  const client = getR2Client();
  const progress: Progress = { ok: true, done: false, deletedObjects: 0, abortedUploads: 0 };
  if (Date.now() >= deadline) return progress;
  const uploads = await client.send(new ListMultipartUploadsCommand({ Bucket, Prefix, MaxUploads: 50 }));
  // Check all paths before the first mutation. Do not trust persisted item keys.
  for (const upload of uploads.Uploads ?? []) {
    assertKey(upload.Key, Prefix);
    if (!upload.UploadId) throw new Error("R2 nevrátil ID rozpracovaného nahrávania.");
  }
  progress.abortedUploads = await batch(uploads.Uploads ?? [], deadline, async upload => {
    try { await client.send(new AbortMultipartUploadCommand({ Bucket, Key: upload.Key!, UploadId: upload.UploadId! })); }
    catch (error) { if (status(error) !== 404) throw error; }
  });
  if (Date.now() >= deadline) return progress;
  const objects = await client.send(new ListObjectsV2Command({ Bucket, Prefix, MaxKeys: 100 }));
  for (const entry of objects.Contents ?? []) assertKey(entry.Key, Prefix);
  const removable = (objects.Contents ?? []).filter(entry => entry.Key !== `${Prefix}gallery.json`);
  progress.deletedObjects = await batch(removable, deadline, async entry => {
    await client.send(new DeleteObjectCommand({ Bucket, Key: entry.Key! }));
  });
  if (Date.now() >= deadline) return progress;
  const [remainingObjects, remainingUploads] = await Promise.all([
    client.send(new ListObjectsV2Command({ Bucket, Prefix, MaxKeys: 2 })),
    client.send(new ListMultipartUploadsCommand({ Bucket, Prefix, MaxUploads: 1 })),
  ]);
  for (const entry of remainingObjects.Contents ?? []) assertKey(entry.Key, Prefix);
  for (const upload of remainingUploads.Uploads ?? []) assertKey(upload.Key, Prefix);
  if (remainingObjects.IsTruncated || remainingUploads.IsTruncated
    || remainingObjects.Contents?.some(entry => entry.Key !== `${Prefix}gallery.json`)
    || remainingUploads.Uploads?.length) return progress;
  await finishDeletion(galleryId);
  progress.done = true;
  return progress;
}
export async function deletePrivateGallery(galleryId: string, confirmation: unknown) {
  await beginDeletion(galleryId, false, confirmation);
  try { return await purgePrivateGallery(galleryId); }
  catch {
    throw new PrivateGalleryError("Prístup je zrušený, ale mazanie v R2 sa nedokončilo. Použi Dokončiť zmazanie galérie.", 503);
  }
}

export function validCleanupAuthorization(authorization: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
type ScanState = { cursor?: string; offset: number; leaseId: string | null; leaseUntil: number };
async function acquireScan() {
  const client = getR2Client();
  let state: ScanState = { offset: 0, leaseId: null, leaseUntil: 0 };
  let previousETag: string | undefined;
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: getOriginalsBucket(), Key: STATE_KEY }));
    if (!response.Body || !response.ETag) throw new Error("Čistenie nemá platný stav.");
    state = JSON.parse(await response.Body.transformToString()) as ScanState;
    if (!Number.isSafeInteger(state.offset) || state.offset < 0 || state.offset > 10
      || !Number.isFinite(state.leaseUntil) || (state.cursor !== undefined && typeof state.cursor !== "string")) {
      throw new Error("Stav čistenia je poškodený.");
    }
    previousETag = response.ETag;
  } catch (error) { if (status(error) !== 404) throw error; }
  if (state.leaseUntil > Date.now()) return null;
  state = { ...state, leaseId: randomUUID(), leaseUntil: Date.now() + 120_000 };
  try {
    const response = await client.send(new PutObjectCommand({
      Bucket: getOriginalsBucket(), Key: STATE_KEY, Body: JSON.stringify(state),
      ContentType: "application/json", CacheControl: "no-store",
      ...(previousETag ? { IfMatch: previousETag } : { IfNoneMatch: "*" }),
    }));
    if (!response.ETag) throw new Error("Čistenie nevrátilo ETag.");
    return { state, etag: response.ETag };
  } catch (error) {
    if (status(error) === 409 || status(error) === 412) return null;
    throw error;
  }
}

export async function runPrivateCleanup() {
  const lease = await acquireScan();
  if (!lease) return { ok: true, busy: true, checked: 0, deleted: 0, errors: 0 };
  const { state, etag } = lease;
  const deadline = Date.now() + 40_000;
  const result = { ok: true, busy: false, checked: 0, deleted: 0, errors: 0 };
  try {
    // Save the page cursor and offset, so a large catalogue or interrupted
    // cleanup does not starve galleries at the end of the list.
    while (Date.now() < deadline && result.checked < 100) {
      const page = await privateGalleryIdPage(state.cursor);
      let incomplete = false;
      for (let index = state.offset; index < page.ids.length && Date.now() < deadline; index++) {
        const id = page.ids[index];
        result.checked++;
        try {
          if (await beginDeletion(id, true)) {
            let progress: Progress;
            do { progress = await purgePrivateGallery(id, deadline); }
            while (!progress.done && Date.now() < deadline);
            if (progress.done) result.deleted++;
            else { state.offset = index; incomplete = true; break; }
          }
        } catch {
          // Leave the persisted deletion state for a retry. Other galleries
          // must not be starved by one corrupt record or a transient R2 error.
          result.errors++;
        }
        state.offset = index + 1;
      }
      if (incomplete || state.offset < page.ids.length) break;
      state.offset = 0;
      state.cursor = page.next;
      if (!page.next) break; // One full scan maximum per invocation.
    }
  } finally {
    state.leaseId = null; state.leaseUntil = 0;
    await getR2Client().send(new PutObjectCommand({
      Bucket: getOriginalsBucket(), Key: STATE_KEY, Body: JSON.stringify(state),
      ContentType: "application/json", CacheControl: "no-store", IfMatch: etag,
    }));
  }
  return result;
}
