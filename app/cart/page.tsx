"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useState,
} from "react";

import { useCart } from "@/components/CartProvider";

export default function CartPage() {
  const {
    items,
    count,
    total,
    removeItem,
    clearCart,
  } = useCart();

  const [email, setEmail] =
    useState("");

  const [consent, setConsent] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const galleryCount =
    new Set(
      items.map(
        (item) =>
          item.gallerySlug,
      ),
    ).size;

  async function handleCheckout(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (items.length === 0) {
      setErrorMessage(
        "Košík je prázdny.",
      );
      return;
    }

    if (!email.trim()) {
      setErrorMessage(
        "Zadajte e-mail.",
      );
      return;
    }

    if (!consent) {
      setErrorMessage(
        "Potvrďte súhlas so spracovaním e-mailu.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const response =
        await fetch(
          "/api/orders",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              items: items.map(
                (item) => ({
                  gallerySlug:
                    item.gallerySlug,

                  photoId:
                    item.photoId,
                }),
              ),

              email:
                email.trim(),
            }),
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Objednávku sa nepodarilo vytvoriť.",
        );
      }

      if (!result.paymentUrl) {
        throw new Error(
          "Platobný odkaz sa nepodarilo pripraviť.",
        );
      }

      window.location.href =
        result.paymentUrl;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Objednávku sa nepodarilo vytvoriť.",
      );

      setIsLoading(false);
    }
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
          ← Galérie
        </Link>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-10 md:py-14">
        <div className="border-b border-white/15 pb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/40 md:text-xs">
            LEDON.
          </p>

          <div className="mt-5 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-light uppercase tracking-[0.08em] md:text-6xl">
                Košík
              </h1>

              {count > 0 ? (
                <p className="mt-4 text-xs uppercase tracking-[0.25em] text-white/45">
                  {galleryCount === 1
                    ? "1 galéria"
                    : `${galleryCount} galérie`}
                </p>
              ) : null}
            </div>

            {count > 0 ? (
              <div className="text-left md:text-right">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                  Vybrané fotografie
                </p>

                <p className="mt-2 text-2xl font-light">
                  {count}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {count === 0 ? (
          <div className="py-20 text-center">
            <p className="text-2xl font-light">
              Košík je prázdny.
            </p>

            <Link
              href="/"
              className="mt-10 inline-block bg-white px-8 py-5 text-xs font-semibold uppercase tracking-[0.25em] text-black transition hover:bg-white/80"
            >
              Zobraziť galérie
            </Link>
          </div>
        ) : (
          <div className="grid gap-12 pt-10 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="divide-y divide-white/10 border-t border-white/10">
                {items.map(
                  (item) => (
                    <div
                      key={`${item.gallerySlug}-${item.photoId}`}
                      className="flex items-center gap-4 py-5 md:gap-7 md:py-7"
                    >
                      <div className="relative h-24 w-32 shrink-0 overflow-hidden bg-white/5 sm:h-28 sm:w-40 md:h-32 md:w-48">
                        <Image
                          src={
                            item.photoSrc
                          }
                          alt={
                            item.photoId
                          }
                          fill
                          sizes="192px"
                          className="object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base tracking-[0.12em] md:text-xl">
                          {
                            item.photoId
                          }
                        </p>

                        <p className="mt-2 truncate text-[10px] uppercase tracking-[0.2em] text-white/40">
                          {
                            item.galleryTitle
                          }
                        </p>

                        <p className="mt-3 text-xl font-light">
                          {
                            item.price
                          }{" "}
                          €
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeItem(
                            item.gallerySlug,
                            item.photoId,
                          )
                        }
                        disabled={
                          isLoading
                        }
                        className="shrink-0 border border-white/20 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-white/60 transition hover:border-white hover:bg-white hover:text-black disabled:opacity-40"
                      >
                        Odobrať
                      </button>
                    </div>
                  ),
                )}
              </div>

              <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/"
                  className="border border-white/25 px-6 py-4 text-center text-[10px] uppercase tracking-[0.22em] text-white/75 transition hover:border-white hover:text-white"
                >
                  ← Pokračovať vo výbere
                </Link>

                <button
                  type="button"
                  onClick={
                    clearCart
                  }
                  disabled={
                    isLoading
                  }
                  className="border border-white/15 px-6 py-4 text-[10px] uppercase tracking-[0.22em] text-white/45 transition hover:border-white/50 hover:text-white disabled:opacity-40"
                >
                  Vyprázdniť košík
                </button>
              </div>
            </div>

            <aside className="h-fit border border-white/15 bg-[#0d0d0d] p-7 md:p-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                Súhrn
              </p>

              <div className="mt-8 flex items-center justify-between border-b border-white/10 pb-5">
                <span className="text-sm text-white/50">
                  Počet fotografií
                </span>

                <span className="text-lg">
                  {count}
                </span>
              </div>

              <div className="flex items-end justify-between border-b border-white/10 py-6">
                <span className="text-sm text-white/50">
                  Celková cena
                </span>

                <span className="text-4xl font-light">
                  {total} €
                </span>
              </div>

              <form
                onSubmit={
                  handleCheckout
                }
                className="mt-7"
              >
                <label
                  htmlFor="cart-email"
                  className="block text-[10px] uppercase tracking-[0.25em] text-white/45"
                >
                  E-mail na doručenie
                </label>

                <input
                  id="cart-email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target
                        .value,
                    )
                  }
                  autoComplete="email"
                  placeholder="vas@email.sk"
                  disabled={
                    isLoading
                  }
                  className="mt-3 w-full border border-white/25 bg-black px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white disabled:opacity-50"
                />

                <label className="mt-5 flex cursor-pointer items-start gap-3 text-xs leading-5 text-white/50">
                  <input
                    type="checkbox"
                    checked={
                      consent
                    }
                    onChange={(
                      event,
                    ) =>
                      setConsent(
                        event.target
                          .checked,
                      )
                    }
                    disabled={
                      isLoading
                    }
                    className="mt-1 h-4 w-4 shrink-0"
                  />

                  <span>
                    Súhlasím so
                    spracovaním e-mailu
                    na vybavenie a
                    doručenie
                    objednávky.
                  </span>
                </label>

                {errorMessage ? (
                  <p className="mt-5 text-sm leading-6 text-red-400">
                    {
                      errorMessage
                    }
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    isLoading
                  }
                  className="mt-7 w-full bg-white px-6 py-5 text-xs font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-white/80 disabled:cursor-wait disabled:opacity-50"
                >
                  {isLoading
                    ? "Vytváram objednávku..."
                    : `Zaplatiť ${total} € cez Revolut`}
                </button>
              </form>

              <p className="mt-5 text-center text-[10px] uppercase tracking-[0.15em] text-white/25">
                Platba cez Revolut Pro
              </p>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}