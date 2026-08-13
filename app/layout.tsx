import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://ledon.photos"),
  title: {
    default: "Ledon Photos | Motorsport fotografia",
    template: "%s | Ledon Photos",
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
  authors: [{ name: "Ledon Photos" }],
  creator: "Ledon Photos",
  publisher: "Ledon Photos",
  alternates: {
    canonical: "https://ledon.photos",
  },
  openGraph: {
    title: "Ledon Photos | Motorsport fotografia",
    description:
      "Motorsport fotografia zo Slovenska. Motorky, okruhy, preteky, panning a galérie z motoristických podujatí.",
    url: "https://ledon.photos",
    siteName: "Ledon Photos",
    type: "website",
    locale: "sk_SK",
    images: [
      {
        url: "/images/babagp.jpg",
        width: 1200,
        height: 630,
        alt: "Ledon Photos - Motorsport fotografia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ledon Photos | Motorsport fotografia",
    description:
      "Motorsport fotografia zo Slovenska. Motorky, okruhy, preteky a galérie z motoristických podujatí.",
    images: ["/images/babagp.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}