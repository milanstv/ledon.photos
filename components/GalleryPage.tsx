import Link from "next/link";

import CartLink from "@/components/CartLink";
import GalleryLightbox from "@/components/GalleryLightbox";
import { getGallery } from "@/data/galleries";
import {
  translations,
  type Language,
} from "@/lib/i18n";

type Gallery = NonNullable<
  ReturnType<typeof getGallery>
>;

type GalleryPageProps = {
  gallery: Gallery;
  language: Language;
};

export default function GalleryPage({
  gallery,
  language,
}: GalleryPageProps) {
  const t = translations[language];

  const homeHref =
    language === "en"
      ? "/en"
      : "/";

  const skHref =
    `/galleries/${gallery.slug}`;

  const enHref =
    `/en/galleries/${gallery.slug}`;

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-5 md:px-10 md:py-7">
        <Link
          href={homeHref}
          className="text-2xl font-bold tracking-[0.12em] md:text-4xl"
        >
          LEDON.
        </Link>

        <div className="flex items-center gap-5 md:gap-6">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] md:text-xs">
            <Link
              href={skHref}
              className={
                language === "sk"
                  ? "text-white"
                  : "text-white/35 transition hover:text-white"
              }
            >
              SK
            </Link>

            <span className="text-white/20">
              |
            </span>

            <Link
              href={enHref}
              className={
                language === "en"
                  ? "text-white"
                  : "text-white/35 transition hover:text-white"
              }
            >
              EN
            </Link>
          </div>

          <CartLink
            language={language}
            className="text-base font-semibold text-white transition hover:text-white/70 md:text-lg"
          />

          <Link
            href={homeHref}
            className="text-[10px] uppercase tracking-[0.3em] text-white/60 transition hover:text-white md:text-xs"
          >
            ← {t.backToGalleries}
          </Link>
        </div>
      </header>

      <section className="px-5 py-10 md:px-10 md:py-14">
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/40 md:text-xs">
          {t.ledonGallery}
        </p>

        <div className="mt-5 flex flex-col justify-between gap-6 border-b border-white/15 pb-10 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-light uppercase tracking-[0.08em] md:text-5xl">
              {gallery.title}
            </h1>

            <p className="mt-4 text-xs uppercase tracking-[0.3em] text-white/50">
              {gallery.date}
            </p>
          </div>

          <div className="text-left md:text-right">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              {t.photoCount}
            </p>

            <p className="mt-2 text-2xl font-light">
              {gallery.photos.length}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5 md:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
            INFO
          </p>

          <div className="mt-5 space-y-4 text-sm leading-7 text-white/70 md:text-base">
            <p>
              {t.infoText1Before}{" "}
              <strong className="font-semibold text-white">
                {t.infoText1Strong}
              </strong>
              {t.infoText1After}
            </p>

            <p>
              {t.infoText2Before}{" "}
              <strong className="font-semibold text-white">
                {t.infoText2Strong}
              </strong>
              {t.infoText2After}
            </p>

            <p>
              {t.infoText3Before}{" "}
              <strong className="font-semibold text-white">
                {t.infoText3Strong}
              </strong>
            </p>

            <div className="border-t border-white/10 pt-4">
              <p>
                <span className="text-white/45">
                  {t.emailLabel}
                </span>{" "}
                <a
                  href="mailto:moto@ledon.photos"
                  className="text-white underline underline-offset-4 transition hover:text-white/60"
                >
                  moto@ledon.photos
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <GalleryLightbox
        gallery={gallery}
        language={language}
      />

      <footer className="mt-10 flex justify-between border-t border-white/10 px-5 py-8 text-xs text-white/35 md:px-10">
        <span>LEDON.</span>
        <span>© 2026 LEDON.</span>
      </footer>
    </main>
  );
}