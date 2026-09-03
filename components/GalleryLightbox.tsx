"use client";

import Image from "next/image";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import AddToCartButton from "@/components/AddToCartButton";
import CartLink from "@/components/CartLink";
import type { Gallery } from "@/data/galleries";

type GalleryLightboxProps = {
  gallery: Gallery;
};

type TimedPhoto = Gallery["photos"][number] & {
  takenAt?: string | null;
};

export default function GalleryLightbox({
  gallery,
}: GalleryLightboxProps) {
  const allPhotos =
    gallery.photos as TimedPhoto[];

  const [selectedIndex, setSelectedIndex] =
    useState<number | null>(null);

  const [fromTime, setFromTime] =
    useState("");

  const [toTime, setToTime] =
    useState("");

  const [activeFromTime, setActiveFromTime] =
    useState("");

  const [activeToTime, setActiveToTime] =
    useState("");

  const hasTimeData = useMemo(
    () =>
      allPhotos.some(
        (photo) =>
          typeof photo.takenAt === "string" &&
          photo.takenAt.length === 5,
      ),
    [allPhotos],
  );

  const isTimeFilterActive =
    activeFromTime !== "" ||
    activeToTime !== "";

  const visiblePhotos = useMemo(() => {
    if (!isTimeFilterActive) {
      return allPhotos;
    }

    return allPhotos.filter((photo) => {
      const takenAt = photo.takenAt;

      if (!takenAt) {
        return false;
      }

      if (
        activeFromTime &&
        takenAt < activeFromTime
      ) {
        return false;
      }

      if (
        activeToTime &&
        takenAt > activeToTime
      ) {
        return false;
      }

      return true;
    });
  }, [
    allPhotos,
    activeFromTime,
    activeToTime,
    isTimeFilterActive,
  ]);

  const currentPhoto =
    selectedIndex !== null
      ? visiblePhotos[selectedIndex]
      : null;

  const isOpen =
    currentPhoto !== null &&
    currentPhoto !== undefined;

  function openPhoto(
    photoIndex: number,
  ) {
    const photo =
      visiblePhotos[photoIndex];

    if (!photo) {
      return;
    }

    setSelectedIndex(photoIndex);

    window.history.replaceState(
      null,
      "",
      `/galleries/${gallery.slug}/${photo.id}`,
    );
  }

  function closePhoto() {
    setSelectedIndex(null);

    window.history.replaceState(
      null,
      "",
      `/galleries/${gallery.slug}`,
    );
  }

  function showPreviousPhoto() {
    if (
      selectedIndex === null ||
      selectedIndex <= 0
    ) {
      return;
    }

    const newIndex =
      selectedIndex - 1;

    const photo =
      visiblePhotos[newIndex];

    if (!photo) {
      return;
    }

    setSelectedIndex(newIndex);

    window.history.replaceState(
      null,
      "",
      `/galleries/${gallery.slug}/${photo.id}`,
    );
  }

  function showNextPhoto() {
    if (
      selectedIndex === null ||
      selectedIndex >=
        visiblePhotos.length - 1
    ) {
      return;
    }

    const newIndex =
      selectedIndex + 1;

    const photo =
      visiblePhotos[newIndex];

    if (!photo) {
      return;
    }

    setSelectedIndex(newIndex);

    window.history.replaceState(
      null,
      "",
      `/galleries/${gallery.slug}/${photo.id}`,
    );
  }

  function handleTimeSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSelectedIndex(null);

    setActiveFromTime(fromTime);
    setActiveToTime(toTime);

    window.history.replaceState(
      null,
      "",
      `/galleries/${gallery.slug}`,
    );
  }

  function clearTimeFilter() {
    setFromTime("");
    setToTime("");
    setActiveFromTime("");
    setActiveToTime("");
    setSelectedIndex(null);

    window.history.replaceState(
      null,
      "",
      `/galleries/${gallery.slug}`,
    );
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        closePhoto();
      }

      if (event.key === "ArrowLeft") {
        showPreviousPhoto();
      }

      if (event.key === "ArrowRight") {
        showNextPhoto();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  });

  return (
    <>
      {hasTimeData ? (
        <section className="px-5 pb-10 md:px-10">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 md:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
              Nájsť fotky podľa času
            </p>

            <p className="mt-3 text-sm leading-6 text-white/45">
              Zadajte približný čas, kedy ste
              prechádzali okolo fotografa.
            </p>

            <form
              onSubmit={handleTimeSearch}
              className="mt-6 flex flex-col gap-4 md:flex-row md:items-end"
            >
              <label className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-[0.25em] text-white/45">
                  Od
                </span>

                <input
                  type="time"
                  value={fromTime}
                  onChange={(event) =>
                    setFromTime(
                      event.target.value,
                    )
                  }
                  className="h-12 rounded-lg border border-white/15 bg-black px-4 text-base text-white outline-none transition focus:border-white/40"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-[0.25em] text-white/45">
                  Do
                </span>

                <input
                  type="time"
                  value={toTime}
                  onChange={(event) =>
                    setToTime(
                      event.target.value,
                    )
                  }
                  className="h-12 rounded-lg border border-white/15 bg-black px-4 text-base text-white outline-none transition focus:border-white/40"
                />
              </label>

              <button
                type="submit"
                className="h-12 rounded-lg bg-white px-7 text-xs font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-white/80"
              >
                Vyhľadať
              </button>
            </form>

            {isTimeFilterActive ? (
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="text-sm text-white/70">
                  Nájdených{" "}
                  <strong className="text-white">
                    {visiblePhotos.length}
                  </strong>{" "}
                  fotografií
                  {activeFromTime
                    ? ` od ${activeFromTime}`
                    : ""}
                  {activeToTime
                    ? ` do ${activeToTime}`
                    : ""}
                  .
                </p>

                <button
                  type="button"
                  onClick={clearTimeFilter}
                  className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-white/55 underline underline-offset-4 transition hover:text-white"
                >
                  Zobraziť všetky fotografie
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {visiblePhotos.length > 0 ? (
        <section className="grid grid-cols-1 gap-2 px-2 pb-2 sm:grid-cols-2 xl:grid-cols-4">
          {visiblePhotos.map(
            (photo, photoIndex) => (
              <button
                key={photo.id}
                type="button"
                onClick={() =>
                  openPhoto(photoIndex)
                }
                className="group relative block aspect-[4/3] overflow-hidden bg-white/5 text-left"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  priority={
                    photoIndex === 0
                  }
                  sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />

                <div className="absolute inset-0 bg-black/10 transition duration-300 group-hover:bg-black/45" />

                <span className="absolute bottom-5 left-5 text-[10px] tracking-[0.25em] text-white/75">
                  {photo.id}
                </span>

                <span className="absolute inset-0 hidden items-center justify-center text-xs uppercase tracking-[0.3em] text-white opacity-0 transition duration-300 group-hover:opacity-100 sm:flex">
                  Zobraziť fotografiu
                </span>
              </button>
            ),
          )}
        </section>
      ) : (
        <div className="px-5 pb-16 text-center md:px-10">
          <div className="border border-white/10 px-6 py-12">
            <p className="text-lg text-white/70">
              V zadanom čase sa nenašli
              žiadne fotografie.
            </p>

            <button
              type="button"
              onClick={clearTimeFilter}
              className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-white underline underline-offset-4"
            >
              Zobraziť všetky fotografie
            </button>
          </div>
        </div>
      )}

      {isOpen &&
      currentPhoto &&
      selectedIndex !== null ? (
        <div className="fixed inset-0 z-[10000] bg-black text-white">
          <div className="absolute left-0 right-0 top-0 z-30 flex h-20 items-center justify-between border-b border-white/10 bg-black/80 px-4 backdrop-blur md:px-7">
            <button
              type="button"
              onClick={closePhoto}
              className="flex items-center gap-3 text-sm text-white transition hover:text-white/65"
            >
              <span className="text-2xl leading-none">
                ←
              </span>

              <span>
                Späť do galérie
              </span>
            </button>

            <div className="flex items-center gap-5 md:gap-8">
              <p className="hidden text-xs uppercase tracking-[0.25em] text-white/45 sm:block">
                {selectedIndex + 1} /{" "}
                {visiblePhotos.length}
              </p>

              <CartLink className="text-base font-semibold text-white transition hover:text-white/70 md:text-lg" />

              <button
                type="button"
                onClick={closePhoto}
                aria-label="Zatvoriť fotografiu"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-2xl transition hover:bg-white hover:text-black"
              >
                ×
              </button>
            </div>
          </div>

          <div className="absolute bottom-[116px] left-0 right-0 top-20 lg:bottom-0 lg:right-[360px]">
            <div className="relative h-full w-full">
              <Image
                src={currentPhoto.src}
                alt={currentPhoto.alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, calc(100vw - 360px)"
                className="object-contain"
              />
            </div>

            <button
              type="button"
              onClick={showPreviousPhoto}
              disabled={
                selectedIndex === 0
              }
              aria-label="Predchádzajúca fotografia"
              className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-2xl backdrop-blur transition hover:bg-white hover:text-black disabled:hidden md:left-6"
            >
              ←
            </button>

            <button
              type="button"
              onClick={showNextPhoto}
              disabled={
                selectedIndex ===
                visiblePhotos.length - 1
              }
              aria-label="Nasledujúca fotografia"
              className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-2xl backdrop-blur transition hover:bg-white hover:text-black disabled:hidden md:right-6"
            >
              →
            </button>
          </div>

          <aside className="absolute bottom-0 right-0 top-20 hidden w-[360px] overflow-y-auto border-l border-white/15 bg-[#090909] px-9 py-12 lg:block">
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/40">
              {gallery.title}
            </p>

            <h2 className="mt-6 text-3xl font-light tracking-[0.12em]">
              {currentPhoto.id}
            </h2>

            {currentPhoto.takenAt ? (
              <p className="mt-4 text-sm text-white/40">
                Čas fotografie:{" "}
                {currentPhoto.takenAt}
              </p>
            ) : null}

            <p className="mt-10 text-4xl font-light">
              {gallery.price} €
            </p>

            <AddToCartButton
              gallerySlug={gallery.slug}
              galleryTitle={gallery.title}
              photoId={currentPhoto.id}
              photoSrc={currentPhoto.src}
              price={gallery.price}
              className="mt-10 w-full bg-white px-6 py-5 text-xs font-semibold uppercase tracking-[0.28em] text-black transition hover:bg-white/80"
            />

            <div className="mt-10 space-y-4 border-t border-white/15 pt-8 text-sm text-white/55">
              <p>
                Originál bez vodoznaku
              </p>

              <p>
                Plné rozlíšenie fotografie
              </p>

              <p>
                Doručenie po potvrdení platby
              </p>
            </div>

            <p className="mt-10 text-xs leading-6 text-white/30">
              Platba prebehne cez Revolut Pro.
              Originál vám odošleme na zadaný
              e-mail.
            </p>
          </aside>

          <div className="absolute bottom-0 left-0 right-0 z-30 border-t border-white/15 bg-[#090909] px-4 py-4 lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-[10px] uppercase tracking-[0.2em] text-white/40">
                  {currentPhoto.id}
                </p>

                <p className="mt-1 text-xl">
                  {gallery.price} €
                </p>
              </div>

              <div className="w-auto shrink-0">
                <AddToCartButton
                  gallerySlug={gallery.slug}
                  galleryTitle={gallery.title}
                  photoId={currentPhoto.id}
                  photoSrc={currentPhoto.src}
                  price={gallery.price}
                  className="bg-white px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-black"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}