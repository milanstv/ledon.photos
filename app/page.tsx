import type { Metadata } from "next";

import HomePage from "@/components/HomePage";

export const metadata: Metadata = {
  title: "Ledon Photos | Motorsport fotografia",

  description:
    "Ledon Photos – motorsport fotografia zo Slovenska. Motorky, okruhy, preteky, panning, galérie a fotografovanie motoristických podujatí.",

  alternates: {
    canonical: "/",

    languages: {
      "sk-SK": "/",
      "en": "/en",
    },
  },

  openGraph: {
    title: "Ledon Photos | Motorsport fotografia",

    description:
      "Motorsport fotografia zo Slovenska. Motorky, okruhy, preteky, panning a galérie z motoristických podujatí.",

    url: "/",

    locale: "sk_SK",

    alternateLocale: [
      "en_US",
    ],
  },

  twitter: {
    title: "Ledon Photos | Motorsport fotografia",

    description:
      "Motorsport fotografia zo Slovenska. Motorky, okruhy, preteky a galérie z motoristických podujatí.",
  },
};

export default function Home() {
  return <HomePage language="sk" />;
}