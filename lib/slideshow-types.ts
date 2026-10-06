export type SlideshowItem = {
  id: string;
  title: string;
  filename: string;
  priceCents: number;
  durationSeconds: number;
  originalKey: string;
  previewKey: string;
  posterKey: string;
  size: number;
  createdAt: string;
};

export type SlideshowGallery = {
  version: 1;
  id: string;
  title: string;
  date: string;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
  nextClipNumber?: number;
  pendingDeletion?: { kind: "gallery" | "item"; itemId?: string; startedAt: string };
  items: SlideshowItem[];
};

export type SlideshowGallerySummary = Pick<SlideshowGallery,
  "id" | "title" | "date" | "status" | "createdAt" | "updatedAt"
> & { count: number };
