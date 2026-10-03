export const PRIVATE_GALLERY_DAYS = 14;

export type MediaKind = "photo" | "video";

export type GalleryVideo = {
  id: string;
  filename: string;
  customerNumber: number | null;
  takenAt: string | null;
  src: string;
  previewSrc: string;
  alt: string;
};

export type VideoGallery = {
  slug: string;
  title: string;
  date: string;
  price: number;
  videos: GalleryVideo[];
};

export type PrivateGalleryStatus =
  | "draft"
  | "active"
  | "blocked"
  | "deleting"
  | "deleted";

export type PrivateGalleryItem = {
  id: string;
  kind: MediaKind;
  filename: string;
  contentType: string;
  size: number;
  originalKey: string;
  thumbnailKey: string | null;
  createdAt: string;
};

export type PrivateGallery = {
  id: string;
  title: string;
  customerName: string;
  status: PrivateGalleryStatus;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
  deletedAt: string | null;
  items: PrivateGalleryItem[];
};

export function isPrivateGalleryExpired(
  gallery: Pick<PrivateGallery, "expiresAt">,
  now = Date.now(),
): boolean {
  if (!gallery.expiresAt) return false;
  const expiresAt = Date.parse(gallery.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

export function isPrivateGalleryAccessible(
  gallery: Pick<PrivateGallery, "status" | "expiresAt">,
  now = Date.now(),
): boolean {
  return (
    gallery.status === "active" &&
    gallery.expiresAt !== null &&
    !isPrivateGalleryExpired(gallery, now)
  );
}
