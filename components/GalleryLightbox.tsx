"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Zoom from "yet-another-react-lightbox/plugins/zoom";

import "yet-another-react-lightbox/styles.css";

import type { Gallery } from "@/data/galleries";

type GalleryLightboxProps = {
  gallery: Gallery;
};

export default function GalleryLightbox({
  gallery,
}: GalleryLightboxProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const slides = useMemo(
    () =>
      gallery.photos.map((photo) => ({
        src: photo.src,
        alt: photo.alt,
      })),
    [gallery.photos],
  );

  const currentPhoto = gallery.photos[index];

  function openPhoto(photoIndex: number) {
    setIndex(photoIndex);
    setOpen(true);

    const photo = gallery.photos[photoIndex];

    window.history.replaceState(
      null,
      "",
      `/galleries/${gallery.slug}/${photo.id}`,
    );
  }

  function closeLightbox() {
    setOpen(false);

    window.history.replaceState(
      null,
      "",
      `/galleries/${gallery.slug}`,
    );
  }

  function changePhoto(photoIndex: number) {
    setIndex(photoIndex);

    const photo = gallery.photos[photoIndex];

    if (photo) {
      window.history.replaceState(
        null,
        "",
        `/galleries/${gallery.slug}/${photo.id}`,
      );
    }
  }

  return (
    <>
      <section className="grid grid-cols-1 gap-2 px-2 pb-2 sm:grid-cols-2 xl:grid-cols-4">
        {gallery.photos.map((photo, photoIndex) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => openPhoto(photoIndex)}
            className="group relative block aspect-[4/3] overflow-hidden bg-white/5 text-left"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              priority={photoIndex === 0}
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
            />

            <div className="absolute inset-0 bg-black/10 transition duration-300 group-hover:bg-black/45" />

            <span className="absolute bottom-5 left-5 text-[10px] tracking-[0.25em] text-white/75">
              {photo.id}
            </span>

            <span className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.3em] text-white opacity-0 transition duration-300 group-hover:opacity-100">
              Zobraziť fotografiu
            </span>
          </button>
        ))}
      </section>

      <Lightbox
        open={open}
        close={closeLightbox}
        index={index}
        slides={slides}
        plugins={[Fullscreen, Zoom]}
        on={{
          view: ({ index: currentIndex }) =>
            changePhoto(currentIndex),
        }}
        controller={{
          closeOnBackdropClick: true,
          closeOnPullDown: true,
        }}
        carousel={{
          finite: true,
          padding: 24,
          spacing: 40,
          imageFit: "contain",
        }}
        animation={{
          fade: 200,
          swipe: 350,
        }}
        toolbar={{
          buttons: ["fullscreen", "close"],
        }}
        styles={{
          root: {
            "--yarl__color_backdrop": "rgba(0, 0, 0, 0.97)",
          },
          container: {
            paddingRight: "360px",
          },
          navigationNext: {
            right: "380px",
          },
          navigationPrev: {
            left: "20px",
          },
          button: {
            filter: "none",
          },
        }}
        render={{
          controls: () =>
            currentPhoto ? (
              <aside className="fixed bottom-0 right-0 top-0 z-[10000] hidden w-[360px] border-l border-white/15 bg-[#090909] px-9 py-28 text-white lg:block">
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">
                  {gallery.title}
                </p>

                <h2 className="mt-6 text-3xl font-light tracking-[0.12em]">
                  {currentPhoto.id}
                </h2>

                <p className="mt-10 text-4xl font-light">
                  {gallery.price} €
                </p>

                <button
                  type="button"
                  className="mt-10 w-full bg-white px-6 py-5 text-xs font-semibold uppercase tracking-[0.28em] text-black transition hover:bg-white/80"
                >
                  Kúpiť originál
                </button>

                <div className="mt-10 space-y-4 border-t border-white/15 pt-8 text-sm text-white/55">
                  <p>Originál bez vodoznaku</p>
                  <p>Plné rozlíšenie fotografie</p>
                  <p>Okamžité stiahnutie po zaplatení</p>
                </div>

                <p className="absolute bottom-10 left-9 right-9 text-xs leading-6 text-white/25">
                  Platbu pripojíme po dokončení galérie.
                </p>
              </aside>
            ) : null,

          iconPrev: () => (
            <span className="text-2xl font-light">←</span>
          ),

          iconNext: () => (
            <span className="text-2xl font-light">→</span>
          ),

          iconClose: () => (
            <span className="text-2xl font-light">×</span>
          ),
        }}
        labels={{
          Previous: "Predchádzajúca fotografia",
          Next: "Nasledujúca fotografia",
          Close: "Zatvoriť",
          Fullscreen: "Celá obrazovka",
          "Exit Fullscreen": "Ukončiť celú obrazovku",
          "Zoom in": "Priblížiť",
          "Zoom out": "Oddialiť",
        }}
      />

      {open && currentPhoto && (
        <div className="fixed bottom-0 left-0 right-0 z-[10001] border-t border-white/15 bg-[#090909]/95 px-5 py-4 text-white backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-5">
            <div>
              <p className="text-[10px] tracking-[0.25em] text-white/40">
                {currentPhoto.id}
              </p>

              <p className="mt-1 text-xl">
                {gallery.price} €
              </p>
            </div>

            <button
              type="button"
              className="bg-white px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-black"
            >
              Kúpiť originál
            </button>
          </div>
        </div>
      )}
    </>
  );
}