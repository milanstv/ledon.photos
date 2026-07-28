import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPhoto } from "@/data/galleries";

type PhotoPageProps = {
  params: Promise<{
    photoId: string;
  }>;
};

export default async function PhotoPage({
  params,
}: PhotoPageProps) {
  const { photoId } = await params;
  const result = getPhoto("baba-gp-2026", photoId);

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
      <header className="flex h-[82px] items-center justify-between border-b border-white/15 px-6 md:px-12">
        <Link
          href="/"
          className="text-2xl font-bold tracking-[0.18em] md:text-3xl"
        >
          LEDON.
        </Link>

        <Link
          href={`/galleries/${gallery.slug}`}
          className="text-xs tracking-[0.3em] text-white/60 transition hover:text-white"
        >
          SPÄŤ DO GALÉRIE
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

          {previousPhoto && (
            <Link
              href={`/galleries/${gallery.slug}/${previousPhoto.id}`}
              aria-label="Predchádzajúca fotografia"
              className="absolute left-5 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/40 px-4 py-3 text-xl backdrop-blur transition hover:border-white hover:bg-black/70"
            >
              ←
            </Link>
          )}

          {nextPhoto && (
            <Link
              href={`/galleries/${gallery.slug}/${nextPhoto.id}`}
              aria-label="Nasledujúca fotografia"
              className="absolute right-5 top-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-black/40 px-4 py-3 text-xl backdrop-blur transition hover:border-white hover:bg-black/70"
            >
              →
            </Link>
          )}
        </div>

        <aside className="border-t border-white/15 px-7 py-10 lg:border-l lg:border-t-0 lg:px-10 lg:py-14">
          <p className="text-xs uppercase tracking-[0.35em] text-white/40">
            {gallery.title}
          </p>

          <h1 className="mt-5 text-3xl font-light tracking-[0.12em]">
            {photo.id}
          </h1>

          <p className="mt-8 text-3xl font-light">
            {gallery.price} €
          </p>

          <button
            type="button"
            className="mt-8 w-full bg-white px-6 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-black transition hover:bg-white/80"
          >
            Kúpiť fotografiu
          </button>

          <div className="mt-10 space-y-3 border-t border-white/15 pt-8 text-sm text-white/55">
            <p>Originál bez vodoznaku</p>
            <p>Plné rozlíšenie fotografie</p>
            <p>Okamžité stiahnutie po zaplatení</p>
          </div>

          <p className="mt-10 text-xs leading-6 text-white/35">
            Tlačidlo nákupu zatiaľ nie je pripojené k platbe.
            Stripe doplníme po dokončení celej galérie.
          </p>
        </aside>
      </section>
    </main>
  );
}