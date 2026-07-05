import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    "Ledon Photos – motorsport fotografia, motorky, okruhy, preteky a galérie z motoristických podujatí.",
  alternates: {
    canonical: "https://ledon.photos",
  },
  openGraph: {
    title: "Ledon Photos | Motorsport fotografia",
    description:
      "Motorsport fotografia, motorky, okruhy, preteky a galérie z motoristických podujatí.",
    url: "https://ledon.photos",
    siteName: "Ledon Photos",
    type: "website",
    locale: "sk_SK",
  },
  robots: {
    index: true,
    follow: true,
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}