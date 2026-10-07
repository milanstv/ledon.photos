import PhotoGalleryEditor from "@/components/PhotoGalleryEditor";
export const dynamic = "force-dynamic";
export const metadata = { title: "Fotogaléria | LEDON admin", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ galleryId: string }> }) {
  return <PhotoGalleryEditor galleryId={(await params).galleryId} />;
}
