import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";
import { listSlideshowGalleries, readSlideshowGallery, saveSlideshowGallery, slideshowPrefix, SlideshowError } from "@/lib/slideshow-galleries";
import type { SlideshowItem } from "@/lib/slideshow-types";

export function validateSlideshowItem(galleryId: string, item: SlideshowItem) {
  const prefix = `${slideshowPrefix(galleryId)}items/${item.id}/`;
  slideshowPrefix(item.id);
  if (item.originalKey !== `${prefix}original.mp4` || item.previewKey !== `${prefix}preview.mp4` || item.posterKey !== `${prefix}poster.jpg` ||
    typeof item.title !== "string" || !item.title.trim() || !Number.isSafeInteger(item.priceCents) || item.priceCents < 1 || item.priceCents > 1000000 ||
    !Number.isFinite(item.durationSeconds) || item.durationSeconds <= 0) throw new SlideshowError("Neplatné údaje slideshow.", 409);
}
export async function changeSlideshowVisibility(id: string, value: unknown) {
  if (value !== "published" && value !== "archived") throw new SlideshowError("Neplatný stav galérie.");
  const record = await readSlideshowGallery(id);
  if (!record) throw new SlideshowError("Galéria sa nenašla.", 404);
  const { gallery, etag } = record;
  if (gallery.pendingDeletion) throw new SlideshowError("Najprv dokonči mazanie v galérii.", 409);
  if (value === "published") {
    if (!gallery.items.length) throw new SlideshowError("Prázdnu galériu nemožno zverejniť.");
    for (const item of gallery.items) {
      validateSlideshowItem(id, item);
      for (const [key, type] of [[item.originalKey, "video/mp4"], [item.previewKey, "video/mp4"], [item.posterKey, "image/jpeg"]]) {
        const head = await getR2Client().send(new HeadObjectCommand({ Bucket: getOriginalsBucket(), Key: key }));
        if (!head.ContentLength || head.ContentType !== type) throw new SlideshowError("Niektorý súbor chýba alebo má neplatný typ.", 409);
      }
    }
  }
  gallery.status = value; gallery.updatedAt = new Date().toISOString();
  await saveSlideshowGallery(gallery, etag);
  return { ok: true };
}
export async function publishedSlideshowGalleries() {
  return (await listSlideshowGalleries()).filter(g => g.status === "published" && g.count > 0);
}
export async function publicSlideshowGallery(id: string) {
  const record = await readSlideshowGallery(id);
  if (!record || record.gallery.status !== "published") throw new SlideshowError("Galéria nie je dostupná.", 404);
  const { gallery } = record;
  return { id: gallery.id, title: gallery.title, date: gallery.date, items: gallery.items.map(item => {
    validateSlideshowItem(id, item);
    const base = `/api/slideshow-galleries/${id}/media/${item.id}`;
    return { id: item.id, title: item.title, priceCents: item.priceCents, durationSeconds: item.durationSeconds,
      posterUrl: `${base}?kind=poster`, previewUrl: `${base}?kind=preview` };
  }) };
}
export async function publicSlideshowMedia(id: string, itemId: string, kind: string | null) {
  if (kind !== "poster" && kind !== "preview") throw new SlideshowError("Súbor nie je dostupný.", 404);
  const record = await readSlideshowGallery(id);
  if (!record || record.gallery.status !== "published") throw new SlideshowError("Galéria nie je dostupná.", 404);
  const item = record.gallery.items.find(i => i.id === itemId);
  if (!item) throw new SlideshowError("Slideshow sa nenašlo.", 404);
  validateSlideshowItem(id, item);
  return getSignedUrl(getR2Client(), new GetObjectCommand({ Bucket: getOriginalsBucket(),
    Key: kind === "poster" ? item.posterKey : item.previewKey, ResponseCacheControl: "private, no-store",
    ResponseContentDisposition: "inline" }), { expiresIn: 300 });
}
