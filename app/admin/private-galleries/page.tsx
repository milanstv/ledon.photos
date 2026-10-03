import type { Metadata } from "next";
import PrivateGalleriesAdmin from "@/components/PrivateGalleriesAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Súkromné galérie | LEDON.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <PrivateGalleriesAdmin />;
}
