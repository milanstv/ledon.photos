import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { PrivateGallery, PrivateGalleryItem } from "@/lib/media-types";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";

const PREFIX = "_private_galleries/";
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type PrivateGalleryRecord = PrivateGallery & {
  accessToken: string | null;
  removedItemIds?: string[];
  pendingDeletes?: PrivateGalleryItem[];
  deletionStartedAt?: string;
};

export class PrivateGalleryError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "PrivateGalleryError";
  }
}

export function privateGalleryPrefix(id: string): string {
  if (!ID_PATTERN.test(id)) {
    throw new PrivateGalleryError("Neplatné ID galérie.", 400);
  }
  return `${PREFIX}${id}/`;
}

function metadataKey(id: string): string {
  return `${privateGalleryPrefix(id)}gallery.json`;
}

function httpStatus(error: unknown): number | undefined {
  return (error as { $metadata?: { httpStatusCode?: number } } | null)
    ?.$metadata?.httpStatusCode;
}

export async function readPrivateGallery(id: string): Promise<{
  gallery: PrivateGalleryRecord;
  etag: string;
}> {
  const key = metadataKey(id);
  try {
    const response = await getR2Client().send(new GetObjectCommand({
      Bucket: getOriginalsBucket(),
      Key: key,
    }));
    if (!response.Body || !response.ETag) {
      throw new Error("Galéria nemá platný obsah alebo ETag.");
    }
    const gallery = JSON.parse(
      await response.Body.transformToString(),
    ) as PrivateGalleryRecord;
    if (gallery.id !== id || !Array.isArray(gallery.items)) {
      throw new Error("Údaje súkromnej galérie sú poškodené.");
    }
    return { gallery, etag: response.ETag };
  } catch (error) {
    if (httpStatus(error) === 404) {
      throw new PrivateGalleryError("Galéria sa nenašla.", 404);
    }
    throw error;
  }
}

export async function savePrivateGallery(
  gallery: PrivateGalleryRecord,
  etag: string,
): Promise<void> {
  if (!etag) throw new Error("Pri ukladaní galérie chýba ETag.");
  try {
    await getR2Client().send(new PutObjectCommand({
      Bucket: getOriginalsBucket(),
      Key: metadataKey(gallery.id),
      Body: JSON.stringify(gallery),
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-store",
      IfMatch: etag,
    }));
  } catch (error) {
    if (httpStatus(error) === 412 || httpStatus(error) === 409) {
      throw new PrivateGalleryError(
        "Galéria sa medzitým zmenila. Obnov stránku a zopakuj zmenu.",
        409,
      );
    }
    throw error;
  }
}

export async function createPrivateGallery(
  titleValue: unknown,
  customerValue: unknown,
): Promise<PrivateGalleryRecord> {
  const title = typeof titleValue === "string" ? titleValue.trim() : "";
  const customerName = typeof customerValue === "string"
    ? customerValue.trim() : "";
  if (!title || title.length > 160 || !customerName || customerName.length > 120) {
    throw new PrivateGalleryError(
      "Zadaj názov galérie (najviac 160 znakov) a zákazníka (najviac 120 znakov).",
      400,
    );
  }
  const now = new Date().toISOString();
  const gallery: PrivateGalleryRecord = {
    id: randomUUID(), title, customerName,
    status: "draft", createdAt: now, updatedAt: now,
    activatedAt: null, expiresAt: null, deletedAt: null,
    accessToken: null, items: [],
  };
  await getR2Client().send(new PutObjectCommand({
    Bucket: getOriginalsBucket(),
    Key: metadataKey(gallery.id),
    Body: JSON.stringify(gallery),
    ContentType: "application/json; charset=utf-8",
    CacheControl: "no-store",
    IfNoneMatch: "*",
  }));
  return gallery;
}

export async function listPrivateGalleries(): Promise<PrivateGallery[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const response = await getR2Client().send(new ListObjectsV2Command({
      Bucket: getOriginalsBucket(), Prefix: PREFIX, Delimiter: "/",
      ContinuationToken: cursor,
    }));
    for (const entry of response.CommonPrefixes ?? []) {
      const id = entry.Prefix?.slice(PREFIX.length).replace(/\/$/, "");
      if (id && ID_PATTERN.test(id)) ids.push(id);
    }
    cursor = response.IsTruncated ? response.NextContinuationToken : undefined;
    if (response.IsTruncated && !cursor) {
      throw new Error("R2 nevrátil pokračovanie zoznamu galérií.");
    }
  } while (cursor);
  const result: PrivateGallery[] = [];
  for (let offset = 0; offset < ids.length; offset += 10) {
    const batch = await Promise.all(ids.slice(offset, offset + 10).map(readPrivateGallery));
    for (const { gallery } of batch) {
      if (gallery.status === "deleted") continue;
      result.push({
        id: gallery.id, title: gallery.title, customerName: gallery.customerName,
        status: gallery.status, createdAt: gallery.createdAt, updatedAt: gallery.updatedAt,
        activatedAt: gallery.activatedAt, expiresAt: gallery.expiresAt,
        deletedAt: gallery.deletedAt, items: gallery.items,
      });
    }
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// Bounded enumeration for the cleanup worker, including deletion tombstones.
export async function privateGalleryIdPage(cursor?: string) {
  const response = await getR2Client().send(new ListObjectsV2Command({
    Bucket: getOriginalsBucket(), Prefix: PREFIX, Delimiter: "/",
    MaxKeys: 10, ContinuationToken: cursor,
  }));
  const ids = (response.CommonPrefixes ?? []).flatMap(entry => {
    const id = entry.Prefix?.slice(PREFIX.length).replace(/\/$/, "");
    return id && ID_PATTERN.test(id) ? [id] : [];
  });
  const next = response.IsTruncated ? response.NextContinuationToken : undefined;
  if (response.IsTruncated && !next) throw new Error("R2 nevrátil pokračovanie zoznamu galérií.");
  return { ids, next };
}
