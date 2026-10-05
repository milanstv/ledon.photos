import SlideshowPublicIndex from "@/components/SlideshowPublicIndex";
export const dynamic = "force-dynamic";
export const metadata = { title: "Slideshow | LEDON.PHOTOS", robots: { index: false, follow: false } };
export default function Page() { return <SlideshowPublicIndex language="en" />; }
