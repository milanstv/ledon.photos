import { getGallery } from "@/lib/photo-public";
export const dynamic="force-dynamic";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import GalleryPage from "@/components/GalleryPage";
import {
  galleries,
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
  const gallery = await getGallery(slug);

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
      `${gallery.title} – ${gallery.date}. Motorsport fotografia LEDON.PHOTOS.`,

    alternates: {
      canonical: skPath,

      languages: {
        "sk-SK": skPath,
        en: enPath,
      },
    },

    openGraph: {
      title:
        `${gallery.title} | Ledon Photos`,

      description:
        `${gallery.title} – ${gallery.date}. Motorsport fotografia LEDON.PHOTOS.`,

      url: skPath,

      locale: "sk_SK",

      alternateLocale: [
        "en_US",
      ],

      type: "website",
    },

    twitter: {
      title:
        `${gallery.title} | Ledon Photos`,

      description:
        `${gallery.title} – ${gallery.date}. Motorsport fotografia LEDON.PHOTOS.`,
    },
  };
}

export default async function GalleryRoute({
  params,
}: GalleryRouteProps) {
  const { slug } = await params;
  const gallery = await getGallery(slug);

  if (!gallery) {
    notFound();
  }

  return (
    <GalleryPage
      gallery={gallery}
      language="sk"
    />
  );
}