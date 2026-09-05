import type { MetadataRoute } from "next";

import { galleries } from "@/data/galleries";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://ledon.photos";

  const homePages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: {
          "sk-SK": baseUrl,
          en: `${baseUrl}/en`,
        },
      },
    },
    {
      url: `${baseUrl}/en`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: {
          "sk-SK": baseUrl,
          en: `${baseUrl}/en`,
        },
      },
    },
  ];

  const galleryPages: MetadataRoute.Sitemap =
    galleries.flatMap((gallery) => {
      const skUrl =
        `${baseUrl}/galleries/${gallery.slug}`;

      const enUrl =
        `${baseUrl}/en/galleries/${gallery.slug}`;

      return [
        {
          url: skUrl,
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.9,
          alternates: {
            languages: {
              "sk-SK": skUrl,
              en: enUrl,
            },
          },
        },
        {
          url: enUrl,
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.9,
          alternates: {
            languages: {
              "sk-SK": skUrl,
              en: enUrl,
            },
          },
        },
      ];
    });

  const photoPages: MetadataRoute.Sitemap =
    galleries.flatMap((gallery) =>
      gallery.photos.flatMap((photo) => {
        const skUrl =
          `${baseUrl}/galleries/${gallery.slug}/${photo.id}`;

        const enUrl =
          `${baseUrl}/en/galleries/${gallery.slug}/${photo.id}`;

        return [
          {
            url: skUrl,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.7,
            alternates: {
              languages: {
                "sk-SK": skUrl,
                en: enUrl,
              },
            },
          },
          {
            url: enUrl,
            lastModified: new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.7,
            alternates: {
              languages: {
                "sk-SK": skUrl,
                en: enUrl,
              },
            },
          },
        ];
      }),
    );

  return [
    ...homePages,
    ...galleryPages,
    ...photoPages,
  ];
}