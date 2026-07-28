import Link from "next/link";
import { notFound } from "next/navigation";

import GalleryLightbox from "@/components/GalleryLightbox";
import { galleries, getGallery } from "@/data/galleries";

type GalleryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return galleries.map((gallery) => ({
    slug: gallery.slug,
  }));
}

export default async function GalleryPage({
  params,
}: GalleryPageProps) {
  const { slug } = await params;
  const gallery = getGallery(slug);

  if (!gallery) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-5 md:px-10 md:py-7">
        <Link
          href="/"
          className="text-2xl font-bold tracking-[0.12em] md:text-4xl"
        >
          LEDON.
        </Link>

        <Link
          href="/"
          className="text-[10px] uppercase tracking-[0.3em] text-white/60 transition hover:text-white md:text-xs"
        >
          ← Späť na galérie
        </Link>
      </header>

      <section className="px-5 py-10 md:px-10 md:py-14">
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/40 md:text-xs">
          LEDON.GALÉRIA
        </p>

        <div className="mt-5 flex flex-col justify-between gap-6 border-b border-white/15 pb-10 md:flex-row md:items-end">
          <div>
            <h1 className="text-4xl font-light uppercase tracking-[0.08em] md:text-6xl">
              {gallery.title}
            </h1>

            <p className="mt-4 text-xs uppercase tracking-[0.3em] text-white/50">
              {gallery.date}
            </p>
          </div>

          <div className="text-left md:text-right">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              Počet fotografií
            </p>

            <p className="mt-2 text-2xl font-light">
              {gallery.photos.length}
            </p>
          </div>
        </div>
      </section>

      <GalleryLightbox gallery={gallery} />

      <footer className="mt-10 flex justify-between border-t border-white/10 px-5 py-8 text-xs text-white/35 md:px-10">
        <span>LEDON.</span>
        <span>© 2026 LEDON.</span>
      </footer>
    </main>
  );
}