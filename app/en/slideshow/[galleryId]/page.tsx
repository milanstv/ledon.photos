import { notFound } from "next/navigation";
import SlideshowPublicGallery from "@/components/SlideshowPublicGallery";
import { publicSlideshowGallery } from "@/lib/slideshow-public";
import { SlideshowError } from "@/lib/slideshow-galleries";
export const dynamic = "force-dynamic";
export const metadata = { title: "Slideshow | LEDON.PHOTOS", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function Page({ params }: { params: Promise<{ galleryId: string }> }) {
  let gallery;
  try { gallery = await publicSlideshowGallery((await params).galleryId); }
  catch (error) { if (error instanceof SlideshowError && (error.status === 404 || error.status === 400)) notFound(); throw error; }
  return <SlideshowPublicGallery gallery={gallery} language="en" />;
}
