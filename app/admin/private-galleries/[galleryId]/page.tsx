import PrivateGalleryEditor from "@/components/PrivateGalleryEditor";
export const dynamic = "force-dynamic";
export const metadata = { title: "Súkromná galéria | LEDON. ADMIN", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ galleryId: string }> }) {
  const { galleryId } = await params;
  return <PrivateGalleryEditor galleryId={galleryId} />;
}
