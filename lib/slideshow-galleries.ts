import { randomUUID } from "node:crypto";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";
import type { SlideshowGallery, SlideshowGallerySummary } from "@/lib/slideshow-types";

const PREFIX = "_slideshow_galleries/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class SlideshowError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function slideshowPrefix(id: string) {
  if (!UUID.test(id)) throw new SlideshowError("Neplatné ID galérie.");
  return `${PREFIX}${id}/`;
}

export function slideshowSummary(gallery: SlideshowGallery): SlideshowGallerySummary {
  return { id: gallery.id, title: gallery.title, date: gallery.date,
    status: gallery.status, createdAt: gallery.createdAt,
    updatedAt: gallery.updatedAt, count: gallery.items.length };
}

export async function readSlideshowGallery(id: string) {
  const key = `${slideshowPrefix(id)}gallery.json`;
  try {
    const response = await getR2Client().send(new GetObjectCommand({
      Bucket: getOriginalsBucket(), Key: key,
    }));
    if (!response.Body || !response.ETag) throw new Error("Chýbajú údaje galérie.");
    const gallery = JSON.parse(await response.Body.transformToString()) as SlideshowGallery;
    if (!gallery || gallery.version !== 1 || gallery.id !== id ||
      typeof gallery.title !== "string" || typeof gallery.date !== "string" ||
      !["draft", "published", "archived"].includes(gallery.status) ||
      typeof gallery.createdAt !== "string" || typeof gallery.updatedAt !== "string" ||
      !Array.isArray(gallery.items)) throw new Error("Poškodené údaje galérie.");
    return { gallery, etag: response.ETag };
  } catch (error) {
    const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

export async function createSlideshowGallery(titleValue: unknown, dateValue: unknown) {
  const title = typeof titleValue === "string" ? titleValue.trim() : "";
  const date = typeof dateValue === "string" ? dateValue.trim() : "";
  if (!title || title.length > 160 || /[\u0000-\u001f\u007f]/.test(title)) {
    throw new SlideshowError("Zadaj názov galérie (najviac 160 znakov).");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date) {
    throw new SlideshowError("Zadaj platný dátum galérie.");
  }
  const now = new Date().toISOString();
  const gallery: SlideshowGallery = { version: 1, id: randomUUID(), title, date,
    status: "draft", createdAt: now, updatedAt: now, items: [] };
  await getR2Client().send(new PutObjectCommand({
    Bucket: getOriginalsBucket(), Key: `${slideshowPrefix(gallery.id)}gallery.json`,
    Body: JSON.stringify(gallery), ContentType: "application/json; charset=utf-8",
    CacheControl: "no-store", IfNoneMatch: "*",
  }));
  return slideshowSummary(gallery);
}

export async function saveSlideshowGallery(gallery: SlideshowGallery, etag: string) {
  try {
    await getR2Client().send(new PutObjectCommand({
      Bucket: getOriginalsBucket(), Key: `${slideshowPrefix(gallery.id)}gallery.json`,
      Body: JSON.stringify(gallery), ContentType: "application/json; charset=utf-8",
      CacheControl: "no-store", IfMatch: etag,
    }));
  } catch (error) {
    const code = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (code === 412 || code === 409) throw new SlideshowError("Galéria sa medzičasom zmenila. Zopakuj akciu.", 409);
    throw error;
  }
}

export async function listSlideshowGalleries(): Promise<SlideshowGallerySummary[]> {
  const result: SlideshowGallerySummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await getR2Client().send(new ListObjectsV2Command({
      Bucket: getOriginalsBucket(), Prefix: PREFIX, Delimiter: "/",
      MaxKeys: 100, ContinuationToken: cursor,
    }));
    const ids = (page.CommonPrefixes ?? []).map(p => p.Prefix?.slice(PREFIX.length).replace(/\/$/, ""))
      .filter((id): id is string => !!id && UUID.test(id));
    for (let start = 0; start < ids.length; start += 10) {
      const records = await Promise.all(ids.slice(start, start + 10).map(readSlideshowGallery));
      for (const record of records) if (record) result.push(slideshowSummary(record.gallery));
    }
    cursor = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !cursor) throw new Error("Chýba pokračovanie zoznamu galérií.");
  } while (cursor);
  return result.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}
