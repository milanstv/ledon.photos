import { randomBytes, timingSafeEqual } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";
import { PRIVATE_GALLERY_DAYS, isPrivateGalleryAccessible, type PrivateGalleryItem } from "@/lib/media-types";
import { PrivateGalleryError, privateGalleryPrefix, readPrivateGallery, savePrivateGallery, type PrivateGalleryRecord } from "@/lib/private-galleries";

const DAYS_MS = PRIVATE_GALLERY_DAYS * 24 * 60 * 60 * 1000;
function editable(gallery: PrivateGalleryRecord) {
  if (gallery.status !== "draft" && gallery.status !== "blocked") {
    throw new PrivateGalleryError("Pred úpravou súborov galériu zablokuj.", 409);
  }
}
function itemPrefix(galleryId: string, item: PrivateGalleryItem) {
  privateGalleryPrefix(item.id);
  const prefix = `${privateGalleryPrefix(galleryId)}files/${item.id}/`;
  if (!item.originalKey.startsWith(prefix) || (item.thumbnailKey && !item.thumbnailKey.startsWith(prefix))) {
    throw new Error("Súbor nepatrí do tejto súkromnej galérie.");
  }
}
async function change(galleryId: string, update: (gallery: PrivateGalleryRecord) => void) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { gallery, etag } = await readPrivateGallery(galleryId);
    if (gallery.status === "deleted" || gallery.status === "deleting") throw new PrivateGalleryError("Galéria sa maže alebo už bola vymazaná.", 410);
    update(gallery);
    gallery.updatedAt = new Date().toISOString();
    try { await savePrivateGallery(gallery, etag); return gallery; }
    catch (error) {
      if (!(error instanceof PrivateGalleryError) || error.status !== 409 || attempt === 4) throw error;
    }
  }
  throw new Error("Galériu sa nepodarilo uložiť.");
}

export async function activatePrivateGallery(galleryId: string) {
  const gallery = await change(galleryId, gallery => {
    if (gallery.status === "active") {
      if (!isPrivateGalleryAccessible(gallery)) throw new PrivateGalleryError("Platnosť vypršala. Najprv ju predĺž.", 409);
      return;
    }
    editable(gallery);
    if (!gallery.items.length) throw new PrivateGalleryError("Najprv nahraj aspoň jeden súbor.", 400);
    if (gallery.pendingDeletes?.length) throw new PrivateGalleryError("Najprv dokonči mazanie súborov.", 409);
    const now = Date.now();
    if (gallery.activatedAt && (!gallery.expiresAt || Date.parse(gallery.expiresAt) <= now)) {
      throw new PrivateGalleryError("Platnosť vypršala. Najprv ju predĺž.", 409);
    }
    if (!gallery.activatedAt) {
      gallery.activatedAt = new Date(now).toISOString();
      gallery.expiresAt = new Date(now + DAYS_MS).toISOString();
    }
    gallery.accessToken = randomBytes(32).toString("hex");
    gallery.status = "active";
  });
  return { ok: true, expiresAt: gallery.expiresAt };
}
export async function blockPrivateGallery(galleryId: string) {
  await change(galleryId, gallery => {
    if (gallery.status === "draft") throw new PrivateGalleryError("Koncept zákazníkovi nie je sprístupnený.", 409);
    gallery.status = "blocked";
    gallery.accessToken = null;
  });
  return { ok: true };
}
export async function extendPrivateGallery(galleryId: string, expectedExpiresAt: unknown) {
  const gallery = await change(galleryId, gallery => {
    if (!gallery.activatedAt || !gallery.expiresAt) throw new PrivateGalleryError("Koncept ešte nemá začiatok platnosti.", 409);
    if (expectedExpiresAt !== gallery.expiresAt) throw new PrivateGalleryError("Platnosť sa medzitým zmenila. Obnov galériu a skontroluj aktuálny dátum.", 409);
    const previous = Date.parse(gallery.expiresAt);
    if (!Number.isFinite(previous)) throw new Error("Neplatný dátum platnosti.");
    gallery.expiresAt = new Date(Math.max(Date.now(), previous) + DAYS_MS).toISOString();
  });
  return { ok: true, expiresAt: gallery.expiresAt };
}

export async function deletePrivateItem(galleryId: string, itemId: string) {
  privateGalleryPrefix(itemId);
  const gallery = await change(galleryId, gallery => {
    editable(gallery);
    const item = gallery.items.find(item => item.id === itemId);
    if (item) {
      itemPrefix(galleryId, item);
      gallery.items = gallery.items.filter(candidate => candidate.id !== itemId);
      gallery.removedItemIds = [...new Set([...(gallery.removedItemIds ?? []), itemId])];
      gallery.pendingDeletes = [...(gallery.pendingDeletes ?? []), item];
    } else if (!gallery.pendingDeletes?.some(item => item.id === itemId) && !gallery.removedItemIds?.includes(itemId)) {
      throw new PrivateGalleryError("Súbor sa nenašiel.", 404);
    }
  });
  const item = gallery.pendingDeletes?.find(item => item.id === itemId);
  if (!item) return { ok: true };
  itemPrefix(galleryId, item);
  // Hide the item and persist its tombstone before deleting its delivery copy.
  // A retry of an older upload cannot put this item back into the gallery.
  const keys = [item.originalKey, item.thumbnailKey, `${privateGalleryPrefix(galleryId)}uploads/${item.id}.json`].filter((key): key is string => Boolean(key));
  try {
    for (const Key of keys) await getR2Client().send(new DeleteObjectCommand({ Bucket: getOriginalsBucket(), Key }));
  } catch {
    throw new PrivateGalleryError("Súbor je odstránený zo zoznamu, ale vymazanie kópie v R2 sa nedokončilo. Použi Dokončiť zmazanie.", 503);
  }
  await change(galleryId, gallery => {
    gallery.pendingDeletes = (gallery.pendingDeletes ?? []).filter(item => item.id !== itemId);
  });
  return { ok: true };
}

async function customerGallery(galleryId: string, token: unknown) {
  // Use the same response for invalid, blocked and expired customer access.
  const unavailable = () => new PrivateGalleryError("Galéria nie je dostupná. Odkaz je neplatný, zablokovaný alebo jeho platnosť vypršala.", 404);
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) throw unavailable();
  let gallery: PrivateGalleryRecord;
  try { gallery = (await readPrivateGallery(galleryId)).gallery; }
  catch (error) { if (error instanceof PrivateGalleryError) throw unavailable(); throw error; }
  const stored = gallery.accessToken;
  if (!stored || !/^[0-9a-f]{64}$/.test(stored) || !timingSafeEqual(Buffer.from(stored, "hex"), Buffer.from(token, "hex")) || !isPrivateGalleryAccessible(gallery)) throw unavailable();
  return gallery;
}
export async function customerPrivateDetail(galleryId: string, token: unknown) {
  const gallery = await customerGallery(galleryId, token);
  return {
    title: gallery.title, expiresAt: gallery.expiresAt,
    items: gallery.items.map(item => ({ id: item.id, kind: item.kind, filename: item.filename, size: item.size })),
  };
}
export async function customerPrivateFile(galleryId: string, token: unknown, itemId: unknown, download: boolean) {
  const gallery = await customerGallery(galleryId, token);
  if (typeof itemId !== "string") throw new PrivateGalleryError("Súbor sa nenašiel.", 404);
  const item = gallery.items.find(item => item.id === itemId);
  if (!item) throw new PrivateGalleryError("Súbor sa nenašiel.", 404);
  itemPrefix(galleryId, item);
  const remaining = Math.floor((Date.parse(gallery.expiresAt!) - Date.now()) / 1000);
  if (remaining < 1) throw new PrivateGalleryError("Platnosť galérie vypršala.", 404);
  const safeAsciiName = item.filename.replace(/[^a-zA-Z0-9_. -]/g, "_");
  const encoded = encodeURIComponent(item.filename).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const disposition = download ? `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encoded}` : "inline";
  const url = await getSignedUrl(getR2Client(), new GetObjectCommand({
    Bucket: getOriginalsBucket(), Key: item.originalKey,
    ResponseContentType: item.contentType, ResponseCacheControl: "private, no-store", ResponseContentDisposition: disposition,
  }), { expiresIn: Math.min(300, remaining) });
  return { url };
}
