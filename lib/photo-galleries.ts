import { randomUUID } from "node:crypto";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";
import type { PhotoGalleryRecord, PhotoGallerySummary } from "@/lib/photo-gallery-types";

const PREFIX = "_photo_galleries/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export class PhotoGalleryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function photoGalleryPrefix(id: string) {
  if (!UUID.test(id)) throw new PhotoGalleryError("Neplatné ID galérie.");
  return `${PREFIX}${id}/`;
}
export function validatePhotoGalleryDetails(titleValue: unknown, dateValue: unknown, priceValue: unknown) {
  const title = typeof titleValue === "string" ? titleValue.trim() : "";
  const date = typeof dateValue === "string" ? dateValue : "";
  if (!title || title.length > 160 || /[\u0000-\u001f\u007f]/.test(title)) {
    throw new PhotoGalleryError("Zadaj názov galérie (najviac 160 znakov).");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new PhotoGalleryError("Zadaj platný dátum fotenia.");
  }
  if (typeof priceValue !== "number" || !Number.isSafeInteger(priceValue) || priceValue < 1 || priceValue > 1000000) {
    throw new PhotoGalleryError("Zadaj cenu od 0,01 € do 10 000 €.");
  }
  return { title, date, priceCents: priceValue };
}
export function photoGallerySummary(gallery: PhotoGalleryRecord): PhotoGallerySummary {
  return { id: gallery.id, slug: gallery.slug, title: gallery.title, date: gallery.date,
    priceCents: gallery.priceCents, status: gallery.status, createdAt: gallery.createdAt,
    updatedAt: gallery.updatedAt, count: gallery.items.filter(item=>item.status!=="deleted").length,
    readyCount: gallery.items.filter(item => item.status === "ready").length };
}
export async function readPhotoGallery(id: string) {
  try {
    const response = await getR2Client().send(new GetObjectCommand({
      Bucket: getOriginalsBucket(), Key: `${photoGalleryPrefix(id)}gallery.json`,
    }));
    if (!response.Body || !response.ETag) throw new Error("Chýbajú údaje fotogalérie.");
    const gallery = JSON.parse(await response.Body.transformToString()) as PhotoGalleryRecord;
    if (!gallery || gallery.version !== 1 || gallery.id !== id || gallery.slug !== `photos-${id}` ||
      !["draft", "published", "archived"].includes(gallery.status) || !Array.isArray(gallery.items) ||
      !Number.isSafeInteger(gallery.nextPhotoNumber) || gallery.nextPhotoNumber < 1 ||
      typeof gallery.createdAt !== "string" || typeof gallery.updatedAt !== "string") {
      throw new Error("Poškodené údaje fotogalérie.");
    }
    validatePhotoGalleryDetails(gallery.title, gallery.date, gallery.priceCents);
    return { gallery, etag: response.ETag };
  } catch (error) {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}
export async function createPhotoGallery(title: unknown, date: unknown, priceCents: unknown) {
  const details = validatePhotoGalleryDetails(title, date, priceCents);
  const now = new Date().toISOString();
  const id = randomUUID();
  const gallery: PhotoGalleryRecord = { version: 1, id, slug: `photos-${id}`, ...details,
    status: "draft", createdAt: now, updatedAt: now, coverItemId: null, nextPhotoNumber: 1, items: [] };
  await getR2Client().send(new PutObjectCommand({ Bucket: getOriginalsBucket(),
    Key: `${photoGalleryPrefix(id)}gallery.json`, Body: JSON.stringify(gallery),
    ContentType: "application/json; charset=utf-8", CacheControl: "no-store", IfNoneMatch: "*" }));
  return photoGallerySummary(gallery);
}
export async function listPhotoGalleries(): Promise<PhotoGallerySummary[]> {
  const result: PhotoGallerySummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await getR2Client().send(new ListObjectsV2Command({
      Bucket: getOriginalsBucket(), Prefix: PREFIX, Delimiter: "/", MaxKeys: 100, ContinuationToken: cursor,
    }));
    const ids = (page.CommonPrefixes ?? []).map(p => p.Prefix?.slice(PREFIX.length).replace(/\/$/, ""))
      .filter((id): id is string => !!id && UUID.test(id));
    for (let start = 0; start < ids.length; start += 10) {
      const records = await Promise.all(ids.slice(start, start + 10).map(readPhotoGallery));
      for (const record of records) if (record) result.push(photoGallerySummary(record.gallery));
    }
    cursor = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !cursor) throw new Error("Chýba pokračovanie zoznamu fotogalérií.");
  } while (cursor);
  return result.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function requirePhotoGallery(id: string) {
  const record = await readPhotoGallery(id);
  if (!record) throw new PhotoGalleryError("Galéria sa nenašla.", 404);
  return record;
}
export async function savePhotoGallery(gallery: PhotoGalleryRecord, etag: string) {
  try {
    await getR2Client().send(new PutObjectCommand({ Bucket: getOriginalsBucket(),
      Key: `${photoGalleryPrefix(gallery.id)}gallery.json`, Body: JSON.stringify(gallery),
      ContentType: "application/json; charset=utf-8", CacheControl: "no-store", IfMatch: etag }));
  } catch (error) {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "PreconditionFailed" || e.$metadata?.httpStatusCode === 412)
      throw new PhotoGalleryError("Galériu práve zmenila iná požiadavka. Skús znova.", 409);
    throw error;
  }
}

export async function setPhotoGalleryCover(galleryId: string, itemId: string) {
  for (let n=0;n<5;n++) {
    const record=await requirePhotoGallery(galleryId);
    if(record.gallery.status!=="draft") throw new PhotoGalleryError("Titulnú fotografiu možno meniť iba v koncepte.",409);
    const item=record.gallery.items.find(i=>i.id===itemId);
    if(!item || item.status!=="ready" || !item.previewKey || !item.socialKey) throw new PhotoGalleryError("Vyber fotografiu s pripravenými náhľadmi.");
    if(record.gallery.coverItemId===itemId) return {ok:true};
    record.gallery.coverItemId=itemId;
    record.gallery.updatedAt=new Date().toISOString();
    try {await savePhotoGallery(record.gallery,record.etag);return {ok:true};}
    catch(e){if(!(e instanceof PhotoGalleryError)||e.status!==409||n===4) throw e;}
  }
  throw new PhotoGalleryError("Titulnú fotografiu sa nepodarilo uložiť.",409);
}

export async function beginGalleryUpload(id:string,token:string) {
  for(let n=0;n<5;n++) {
    const r=await requirePhotoGallery(id);
    if(r.gallery.status!=="draft" || r.gallery.deletionPending)throw new PhotoGalleryError("Galéria nie je otvorená na nahrávanie.",409);
    r.gallery.activeUploads=[...(r.gallery.activeUploads??[]),token];
    try{await savePhotoGallery(r.gallery,r.etag);return;}catch(e){if(!(e instanceof PhotoGalleryError)||e.status!==409||n===4)throw e;}
  }
}
export async function endGalleryUpload(id:string,token:string) {
  for(let n=0;n<5;n++) {
    const r=await requirePhotoGallery(id);
    r.gallery.activeUploads=(r.gallery.activeUploads??[]).filter(t=>t!==token);
    try{await savePhotoGallery(r.gallery,r.etag);return;}catch(e){if(!(e instanceof PhotoGalleryError)||e.status!==409||n===4)throw e;}
  }
}
