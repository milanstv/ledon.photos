import type { Metadata } from "next";

import HomePage from "@/components/HomePage";

export const metadata: Metadata = {
  title: "Ledon Photos | Motorsport Photography",

  description:
    "Ledon Photos – motorsport photography from Slovakia. Motorcycles, circuits, races, panning photography and galleries from motorsport events.",

  alternates: {
    canonical: "/en",

    languages: {
      "sk-SK": "/",
      "en": "/en",
    },
  },

  openGraph: {
    title: "Ledon Photos | Motorsport Photography",

    description:
      "Motorsport photography from Slovakia. Motorcycles, circuits, races, panning photography and galleries from motorsport events.",

    url: "/en",

    locale: "en_US",

    alternateLocale: [
      "sk_SK",
    ],
  },

  twitter: {
    title: "Ledon Photos | Motorsport Photography",

    description:
      "Motorsport photography from Slovakia. Motorcycles, circuits, races and motorsport galleries.",
  },
};

export default function EnglishHome() {
  return <HomePage language="en" />;
}