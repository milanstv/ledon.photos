// Stored order identifiers stay valid after hiding a gallery. The client never supplies an R2 key.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function slideshowOrderGalleryId(slug: string): string | null {
  if (!slug.startsWith("slideshow-")) return null;
  const id = slug.slice(10);
  if (!UUID.test(id)) throw new Error("Neplatné ID slideshow.");
  return id;
}
export function orderOriginalKey(item: { gallerySlug: string; photoId: string; filename: string }) {
  const id = slideshowOrderGalleryId(item.gallerySlug);
  if (!id) return `${item.gallerySlug}/${item.filename}`;
  if (!UUID.test(item.photoId) || !item.filename.toLowerCase().endsWith(".mp4") || /[\/\\\u0000-\u001f\u007f]/.test(item.filename)) throw new Error("Neplatný súbor slideshow.");
  return `_slideshow_galleries/${id}/items/${item.photoId}/original.mp4`;
}
export function attachmentFilename(filename: string) {
  const fallback = filename.replace(/[^a-zA-Z0-9._ -]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
