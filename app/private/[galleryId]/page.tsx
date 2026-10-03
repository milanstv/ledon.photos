import type { Metadata } from "next";
import PrivateCustomerGallery from "@/components/PrivateCustomerGallery";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Súkromná galéria", description: "Súkromná galéria pre zákazníka LEDON.",
  referrer: "no-referrer",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true, "max-video-preview": 0 } },
};
export default async function Page({ params }: { params: Promise<{ galleryId: string }> }) {
  const { galleryId } = await params;
  return <PrivateCustomerGallery galleryId={galleryId} />;
}
