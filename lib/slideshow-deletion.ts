import { randomUUID } from "node:crypto";
import {
  AbortMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand,
  ListMultipartUploadsCommand, ListObjectsV2Command, PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";
import { readSlideshowGallery, saveSlideshowGallery, slideshowPrefix, SlideshowError } from "@/lib/slideshow-galleries";
import { validateSlideshowItem } from "@/lib/slideshow-public";

const code = (error: unknown) => (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;
const conflict = (error: unknown) => code(error) === 409 || code(error) === 412;
const Bucket = () => getOriginalsBucket();

// Every mutating detail API request uses this lease, including upload completion.
// The lease outlives the route's 60-second execution limit. Crashes release after two minutes.
export async function withSlideshowMutation<T>(id: string, operation: () => Promise<T>): Promise<T> {
  slideshowPrefix(id);
  const Key = `_slideshow_locks/${id}.json`;
  const client = getR2Client();
  let previous: string | undefined;
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: Bucket(), Key }));
    if (!response.Body || !response.ETag) throw new Error("Neplatný zámok galérie.");
    const lease = JSON.parse(await response.Body.transformToString()) as { until?: number };
    if (!Number.isFinite(lease.until)) throw new Error("Poškodený zámok galérie.");
    if (lease.until! > Date.now()) throw new SlideshowError("V galérii práve prebieha iná akcia. Chvíľu počkaj a zopakuj ju.", 409);
    previous = response.ETag;
  } catch (error) { if (code(error) !== 404) throw error; }
  let etag: string;
  try {
    const response = await client.send(new PutObjectCommand({ Bucket: Bucket(), Key,
      Body: JSON.stringify({ owner: randomUUID(), until: Date.now() + 120_000 }),
      ContentType: "application/json", CacheControl: "no-store",
      ...(previous ? { IfMatch: previous } : { IfNoneMatch: "*" }),
    }));
    if (!response.ETag) throw new Error("Chýba ETag zámku galérie.");
    etag = response.ETag;
  } catch (error) {
    if (conflict(error)) throw new SlideshowError("V galérii práve prebieha iná akcia. Zopakuj ju.", 409);
    throw error;
  }
  try { return await operation(); }
  finally {
    try {
      await client.send(new PutObjectCommand({ Bucket: Bucket(), Key,
        Body: JSON.stringify({ until: 0 }), ContentType: "application/json", CacheControl: "no-store", IfMatch: etag,
      }));
    } catch { console.error("Slideshow: zámok zostane aktívny najviac dve minúty."); }
  }
}

function assertKey(key: string | undefined, prefix: string): asserts key is string {
  if (!key || !key.startsWith(prefix) || key === prefix) throw new Error("Súbor je mimo vybranej galérie. Mazanie bolo zastavené.");
}
async function each<T>(values: T[], deadline: number, action: (value: T) => Promise<void>) {
  for (let offset = 0; offset < values.length && Date.now() < deadline; offset += 5) {
    const results = await Promise.allSettled(values.slice(offset, offset + 5).map(action));
    for (const result of results) if (result.status === "rejected") throw result.reason;
  }
}

// Called only inside withSlideshowMutation. Persist progress before touching media;
// failed/time-limited passes remain hidden and can be resumed from the editor.
export async function deleteSlideshow(id: string, kind: "item" | "gallery", itemId: unknown, confirmation: unknown) {
  const prefix = slideshowPrefix(id);
  if (kind === "item") {
    if (typeof itemId !== "string") throw new SlideshowError("Chýba ID klipu.");
    slideshowPrefix(itemId);
  }
  const record = await readSlideshowGallery(id);
  if (!record) {
    if (kind === "gallery") return { ok: true, done: true };
    throw new SlideshowError("Galéria sa nenašla.", 404);
  }
  const { gallery, etag } = record;
  if (gallery.status === "published") throw new SlideshowError("Pred zmazaním galériu skry.", 409);
  const item = kind === "item" ? gallery.items.find(i => i.id === itemId) : undefined;
  if (kind === "item" && !item) throw new SlideshowError("Klip sa nenašiel.", 404);
  if (item) validateSlideshowItem(id, item);
  if (confirmation !== (kind === "gallery" ? gallery.title : item!.title)) {
    throw new SlideshowError("Pre zmazanie napíš presný názov.");
  }
  const pending = gallery.pendingDeletion;
  if (pending && (pending.kind !== kind || pending.itemId !== (kind === "item" ? itemId : undefined))) {
    throw new SlideshowError("Najprv dokonči predchádzajúce mazanie.", 409);
  }
  if (!pending) {
    const largest = gallery.items.reduce((value, current) => {
      const match = /^Klip(\d+)$/.exec(current.title);
      return match ? Math.max(value, Number(match[1])) : value;
    }, 0);
    const next = Math.max(gallery.nextClipNumber ?? 1, largest + 1);
    if (!Number.isSafeInteger(next) || next < 1 || next >= Number.MAX_SAFE_INTEGER) {
      throw new SlideshowError("Neplatné číslovanie klipov.", 409);
    }
    gallery.nextClipNumber = next;
    gallery.pendingDeletion = { kind, ...(kind === "item" ? { itemId: itemId as string } : {}), startedAt: new Date().toISOString() };
    gallery.updatedAt = new Date().toISOString();
    await saveSlideshowGallery(gallery, etag);
  }
  const target = kind === "gallery" ? prefix : `${prefix}items/${itemId}/`;
  const client = getR2Client();
  const deadline = Date.now() + 35_000;
  try {
    do {
      const uploads = await client.send(new ListMultipartUploadsCommand({ Bucket: Bucket(), Prefix: target, MaxUploads: 50 }));
      for (const upload of uploads.Uploads ?? []) {
        assertKey(upload.Key, target);
        if (!upload.UploadId) throw new Error("Chýba ID nahrávania.");
      }
      await each(uploads.Uploads ?? [], deadline, async upload => {
        try { await client.send(new AbortMultipartUploadCommand({ Bucket: Bucket(), Key: upload.Key!, UploadId: upload.UploadId! })); }
        catch (error) { if (code(error) !== 404) throw error; }
      });
      if (Date.now() >= deadline) return { ok: true, done: false };
      const objects = await client.send(new ListObjectsV2Command({ Bucket: Bucket(), Prefix: target, MaxKeys: 100 }));
      for (const object of objects.Contents ?? []) assertKey(object.Key, target);
      await each((objects.Contents ?? []).filter(o => o.Key !== `${prefix}gallery.json`), deadline,
        async object => { await client.send(new DeleteObjectCommand({ Bucket: Bucket(), Key: object.Key! })); });
      if (Date.now() >= deadline) return { ok: true, done: false };
      const [remaining, unfinished] = await Promise.all([
        client.send(new ListObjectsV2Command({ Bucket: Bucket(), Prefix: target, MaxKeys: 2 })),
        client.send(new ListMultipartUploadsCommand({ Bucket: Bucket(), Prefix: target, MaxUploads: 1 })),
      ]);
      for (const o of remaining.Contents ?? []) assertKey(o.Key, target);
      for (const u of unfinished.Uploads ?? []) assertKey(u.Key, target);
      if (remaining.IsTruncated || unfinished.IsTruncated || unfinished.Uploads?.length ||
        remaining.Contents?.some(o => o.Key !== `${prefix}gallery.json`)) continue;
      if (kind === "gallery") {
        await client.send(new DeleteObjectCommand({ Bucket: Bucket(), Key: `${prefix}gallery.json` }));
      } else {
        await client.send(new DeleteObjectCommand({ Bucket: Bucket(), Key: `${prefix}uploads/${itemId}.json` }));
        const latest = await readSlideshowGallery(id);
        if (!latest || latest.gallery.pendingDeletion?.kind !== "item" || latest.gallery.pendingDeletion.itemId !== itemId) {
          throw new Error("Stav mazania sa zmenil.");
        }
        latest.gallery.items = latest.gallery.items.filter(i => i.id !== itemId);
        // nextClipNumber is intentionally retained, including after deleting the last clip.
        delete latest.gallery.pendingDeletion;
        latest.gallery.updatedAt = new Date().toISOString();
        await saveSlideshowGallery(latest.gallery, latest.etag);
      }
      return { ok: true, done: true };
    } while (Date.now() < deadline);
    return { ok: true, done: false };
  } catch {
    throw new SlideshowError("Mazanie v R2 sa nedokončilo. Galéria zostáva skrytá. Použi Dokončiť mazanie.", 503);
  }
}
