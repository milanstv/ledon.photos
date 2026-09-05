import type { Metadata } from "next";
import { notFound } from "next/navigation";

import GalleryPage from "@/components/GalleryPage";
import {
  galleries,
  getGallery,
} from "@/data/galleries";

type GalleryRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return galleries.map((gallery) => ({
    slug: gallery.slug,
  }));
}

export async function generateMetadata({
  params,
}: GalleryRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const gallery = getGallery(slug);

  if (!gallery) {
    return {};
  }

  const skPath =
    `/galleries/${gallery.slug}`;

  const enPath =
    `/en/galleries/${gallery.slug}`;

  return {
    title: gallery.title,

    description:
      `${gallery.title} – ${gallery.date}. Motorsport photography by LEDON.PHOTOS.`,

    alternates: {
      canonical: enPath,

      languages: {
        "sk-SK": skPath,
        en: enPath,
      },
    },

    openGraph: {
      title:
        `${gallery.title} | Ledon Photos`,

      description:
        `${gallery.title} – ${gallery.date}. Motorsport photography by LEDON.PHOTOS.`,

      url: enPath,

      locale: "en_US",

      alternateLocale: [
        "sk_SK",
      ],

      type: "website",
    },

    twitter: {
      title:
        `${gallery.title} | Ledon Photos`,

      description:
        `${gallery.title} – ${gallery.date}. Motorsport photography by LEDON.PHOTOS.`,
    },
  };
}

export default async function EnglishGalleryRoute({
  params,
}: GalleryRouteProps) {
  const { slug } = await params;

  const gallery = getGallery(slug);

  if (!gallery) {
    notFound();
  }

  return (
    <GalleryPage
      gallery={gallery}
      language="en"
    />
  );
}