import Image from "next/image";
import Link from "next/link";

import CartLink from "@/components/CartLink";
import { galleries } from "@/data/galleries";
import {
  translations,
  type Language,
} from "@/lib/i18n";

type HomePageProps = {
  language: Language;
};

export default function HomePage({
  language,
}: HomePageProps) {
  const t = translations[language];

  const homeHref =
    language === "en" ? "/en" : "/";

  const galleryPrefix =
    language === "en"
      ? "/en/galleries"
      : "/galleries";

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/images/babagp.jpg')",
        }}
      />

      <div className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 bg-gradient-to-r from-black/90 via-black/40 to-black/10" />
      <div className="fixed inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />

      <header className="fixed left-0 top-0 z-50 flex w-full items-center justify-between px-6 py-6 md:px-11 md:py-7">
        <Link
          href={homeHref}
          className="flex items-center"
        >
          <Image
            src="/images/ledon-logo.png"
            alt="LEDON. Photos"
            width={260}
            height={60}
            priority
            className="h-10 w-auto md:h-12"
          />
        </Link>

        <nav className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-[0.25em] md:gap-10 md:text-xs md:tracking-[0.35em]">
          <a
            href="#galleries"
            className="transition hover:text-white/60"
          >
            {t.galleriesNav}
          </a>

          <a
            href="#contact"
            className="transition hover:text-white/60"
          >
            {t.contactNav}
          </a>

          <CartLink className="transition hover:text-white/60" />

          <div className="flex items-center gap-2 tracking-[0.15em]">
            <Link
              href="/"
              className={
                language === "sk"
                  ? "text-white"
                  : "text-white/40 transition hover:text-white"
              }
            >
              SK
            </Link>

            <span className="text-white/25">
              |
            </span>

            <Link
              href="/en"
              className={
                language === "en"
                  ? "text-white"
                  : "text-white/40 transition hover:text-white"
              }
            >
              EN
            </Link>
          </div>
        </nav>
      </header>

      <section
        id="galleries"
        className="relative z-10 flex min-h-screen items-start px-6 pb-12 pt-24 md:px-11 md:pt-24"
      >
        <div className="w-full max-w-[585px]">
          <p className="mb-5 text-[10px] uppercase tracking-[0.48em] text-white/55 md:text-xs">
            {t.testNotice}
          </p>

          <h1 className="text-6xl font-light uppercase tracking-[0.14em] md:text-7xl">
            {t.galleryTitle}
          </h1>

          <div className="mt-11 h-px w-16 bg-white/60" />

          <div className="mt-10 border-t border-white/25">
            {galleries.map((gallery) => (
              <Link
                key={gallery.slug}
                href={`${galleryPrefix}/${gallery.slug}`}
                className="group flex min-h-[58px] items-center justify-between border-b border-white/25 py-4 text-left text-[10px] uppercase tracking-[0.32em] text-white/85 transition hover:bg-white/5 hover:text-white md:text-xs"
              >
                <span className="pr-6">
                  {gallery.title}{" "}
                  {gallery.date}
                </span>

                <span className="shrink-0 text-base text-white/70 transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="relative z-10 border-t border-white/20 bg-black px-6 py-10 md:px-11"
      >
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-light">
              {t.contactTitle}
            </h2>

            <p className="mt-3 text-sm text-white/45">
              {t.contactSubtitle}
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <a
              href="https://www.instagram.com/ledon.photos"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/25 px-7 py-4 text-center text-xs uppercase tracking-[0.3em] text-white/80 transition hover:border-white hover:bg-white hover:text-black"
            >
              Instagram
            </a>

            <a
              href="mailto:info@ledon.photos"
              className="border border-white/25 px-7 py-4 text-center text-xs uppercase tracking-[0.3em] text-white/80 transition hover:border-white hover:bg-white hover:text-black"
            >
              Email
            </a>
          </div>
        </div>
      </section>

      <footer className="relative z-10 flex items-center justify-between border-t border-white/10 bg-black px-6 py-8 text-xs text-white/40 md:px-11">
        <span>LEDON.</span>

        <div className="flex items-center gap-5">
          <span>© 2026 LEDON.</span>

          <Link
            href="/admin/orders"
            prefetch={false}
            aria-label={t.adminLabel}
            title={t.adminLabel}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-sm text-white/20 transition hover:border-white/40 hover:text-white/70"
          >
            ⚙
          </Link>
        </div>
      </footer>
    </main>
  );
}