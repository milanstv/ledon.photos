import type { Metadata } from "next";
import SlideshowGalleryEditor from "@/components/SlideshowGalleryEditor";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Upraviť slideshow | LEDON.", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ galleryId: string }> }) {
  return <SlideshowGalleryEditor galleryId={(await params).galleryId} />;
}
