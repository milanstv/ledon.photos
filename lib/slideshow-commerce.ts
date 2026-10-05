import { readSlideshowGallery, SlideshowError } from "@/lib/slideshow-galleries";
import { validateSlideshowItem } from "@/lib/slideshow-public";
import { orderOriginalKey, slideshowOrderGalleryId } from "@/lib/slideshow-order";
export async function slideshowOrderItem(slug: string, itemId: string) {
  let id: string | null;
  try { id = slideshowOrderGalleryId(slug); } catch { throw new SlideshowError("Neplatné slideshow.", 400); }
  if (!id) return null;
  const record = await readSlideshowGallery(id);
  if (!record || record.gallery.status !== "published") throw new SlideshowError("Slideshow už nie je v predaji. Odober ho z košíka.", 404);
  const { gallery } = record;
  const item = gallery.items.find(item => item.id === itemId);
  if (!item) throw new SlideshowError("Slideshow sa nenašlo. Odober ho z košíka.", 404);
  validateSlideshowItem(id, item);
  const result = { itemKey: `${slug}:${item.id}`, gallerySlug: slug, galleryTitle: gallery.title,
    galleryDate: gallery.date, photoId: item.id, filename: item.filename,
    mediaTitle: item.title, price: item.priceCents / 100 };
  try { orderOriginalKey(result); } catch { throw new SlideshowError("Neplatný súbor slideshow.", 409); }
  return result;
}
