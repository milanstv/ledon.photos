import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default:
      "Ledon Photos | Motorsport Photography",
    template:
      "%s | Ledon Photos",
  },

  description:
    "Ledon Photos – motorsport photography from Slovakia. Motorcycles, circuits, races, panning photography and galleries from motorsport events.",

  keywords: [
    "Ledon Photos",
    "motorsport photography",
    "motorcycle photography",
    "motorcycle photographer",
    "track photography",
    "panning photography",
    "Slovakia Ring",
    "Pezinská Baba",
    "motorsport Slovakia",
    "photographer Slovakia",
  ],

  openGraph: {
    title:
      "Ledon Photos | Motorsport Photography",

    description:
      "Motorsport photography from Slovakia. Motorcycles, circuits, races, panning photography and galleries from motorsport events.",

    siteName:
      "Ledon Photos",

    type:
      "website",

    locale:
      "en_US",
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Ledon Photos | Motorsport Photography",

    description:
      "Motorsport photography from Slovakia. Motorcycles, circuits, races and motorsport galleries.",
  },
};

export default function EnglishLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return children;
}