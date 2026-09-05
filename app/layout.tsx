import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import "./globals.css";

import { CartProvider } from "@/components/CartProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://ledon.photos",
  ),

  title: {
    default:
      "Ledon Photos | Motorsport fotografia",
    template:
      "%s | Ledon Photos",
  },

  description:
    "Ledon Photos – motorsport fotografia zo Slovenska. Motorky, okruhy, preteky, panning, galérie a fotografovanie motoristických podujatí.",

  keywords: [
    "Ledon Photos",
    "motorsport fotografia",
    "fotograf motorky",
    "fotografovanie motoriek",
    "motorky na okruhu",
    "panning fotografia",
    "Slovakia Ring",
    "Pezinská Baba",
    "motoršport Slovensko",
    "fotograf Slovensko",
  ],

  authors: [
    {
      name: "Ledon Photos",
    },
  ],

  creator:
    "Ledon Photos",

  publisher:
    "Ledon Photos",

  openGraph: {
    siteName:
      "Ledon Photos",

    type:
      "website",

    images: [
      {
        url:
          "/images/babagp.jpg",
        width: 1200,
        height: 630,
        alt:
          "Ledon Photos - Motorsport photography",
      },
    ],
  },

  twitter: {
    card:
      "summary_large_image",

    images: [
      "/images/babagp.jpg",
    ],
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview":
        "large",
      "max-snippet":
        -1,
      "max-video-preview":
        -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html
      lang="sk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}