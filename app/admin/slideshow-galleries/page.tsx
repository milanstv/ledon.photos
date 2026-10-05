import type { Metadata } from "next";
import SlideshowGalleriesAdmin from "@/components/SlideshowGalleriesAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Slideshow galérie | LEDON.",
  robots: { index: false, follow: false },
};

export default function Page() { return <SlideshowGalleriesAdmin />; }
