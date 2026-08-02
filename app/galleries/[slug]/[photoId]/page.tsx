import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import BuyPhotoButton from "@/components/BuyPhotoButton";
import { getPhoto } from "@/data/galleries";

type PhotoPageProps = {
  params: Promise<{
    slug: string;
    photoId: string;
  }>;
};

export default async function PhotoPage({
  params,
}: PhotoPageProps) {
  const { slug, photoId } = await params;

  const result = getPhoto(slug, photoId);

  if (!result) {
    notFound();
  }

  const {
    gallery,
    photo,
    previousPhoto,
    nextPhoto,
  } = result;

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <header className="flex h-[82px] items-center justify-between border-b border-white/15 px-5 md:px-12">
        <Link
          href="/"
          className="text-2xl font-bold tracking-[0.18em] md:text-3xl"
        >
          LEDON.
        </Link>

        <Link
          href={`/galleries/${gallery.slug}`}
          className="text-[10px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white md:text-xs"
        >
          Späť do galérie
        </Link>
      </header>

      <section className="grid min-h-[calc(100vh-82px)] grid-cols-1 lg:grid-cols-[1fr_380px]">
        <div className="relative flex min-h-[55vh] items-center justify-center bg-black p-3 md:p-8">
          <div className="relative h-[70vh] w-full">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, calc(100vw - 380px)"
              className="object-contain"
            />
          </div>

          {previousPhoto ? (
            <Link
              href={`/galleries/${gallery.slug}/${previousPhoto.id}`}
              aria-label="Predchádzajúca fotografia"
              className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/55 text-xl backdrop-blur transition hover:border-white hover:bg-white hover:text-black md:left-6"
            >
              ←
            </Link>
          ) : null}

          {nextPhoto ? (
            <Link
              href={`/galleries/${gallery.slug}/${nextPhoto.id}`}
              aria-label="Nasledujúca fotografia"
              className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/55 text-xl backdrop-blur transition hover:border-white hover:bg-white hover:text-black md:right-6"
            >
              →
            </Link>
          ) : null}
        </div>

        <aside className="border-t border-white/15 px-6 py-10 lg:border-l lg:border-t-0 lg:px-10 lg:py-14">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">
            {gallery.title}
          </p>

          <h1 className="mt-5 text-3xl font-light tracking-[0.12em]">
            {photo.id}
          </h1>

          <div className="mt-8">
            <BuyPhotoButton
              gallerySlug={gallery.slug}
              photoId={photo.id}
              price={gallery.price}
              className="w-full bg-white px-6 py-5 text-xs font-semibold uppercase tracking-[0.24em] text-black transition hover:bg-white/80 disabled:cursor-wait disabled:opacity-60"
            />
          </div>

          <div className="mt-10 space-y-3 border-t border-white/15 pt-8 text-sm text-white/55">
            <p>Originál bez vodoznaku</p>
            <p>Plné rozlíšenie fotografie</p>
            <p>Doručenie e-mailom po potvrdení platby</p>
          </div>
        </aside>
      </section>
    </main>
  );
}