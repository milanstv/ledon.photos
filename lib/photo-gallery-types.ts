export type PhotoGalleryItem = {
  id: string;
  filename: string;
  sourceFilename: string;
  customerNumber: number;
  originalKey: string;
  previewKey: string | null;
  socialKey: string | null;
  takenAt: string | null;
  size: number;
  status: "uploaded" | "ready" | "deleting" | "deleted";
  operation?: { id: string; kind: "preview" | "delete"; startedAt: string };
};
export type PhotoGalleryRecord = {
  deletionPending?: boolean;
  activeUploads?: string[];
  version: 1;
  id: string;
  slug: string;
  title: string;
  date: string;
  priceCents: number;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
  coverItemId: string | null;
  nextPhotoNumber: number;
  items: PhotoGalleryItem[];
};
export type PhotoGallerySummary = Pick<PhotoGalleryRecord,
  "id" | "slug" | "title" | "date" | "priceCents" | "status" | "createdAt" | "updatedAt"
> & { count: number; readyCount: number };
