"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useState,
} from "react";

import { useCart } from "@/components/CartProvider";
import {
  translations,
  type Language,
} from "@/lib/i18n";

type CartPageProps = {
  language: Language;
};

type PaymentMethod =
  | "online"
  | "bank_transfer";

export default function CartPage({
  language,
}: CartPageProps) {
  const t = translations[language];

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

  const [loadingMethod, setLoadingMethod] =
    useState<PaymentMethod | null>(null);

  const [errorMessage, setErrorMessage] =
    useState("");

  const isLoading =
    loadingMethod !== null;

  const homeHref =
    language === "en" ? "/en" : "/";

  const skHref = "/cart";
  const enHref = "/en/cart";

  const galleryCount =
    new Set(
      items.map(
        (item) => item.gallerySlug,
      ),
    ).size;

  async function createOrder(
    paymentMethod: PaymentMethod,
  ) {
    setErrorMessage("");

    if (items.length === 0) {
      setErrorMessage(t.cartEmpty);
      return;
    }

    if (!email.trim()) {
      setErrorMessage(t.enterEmail);
      return;
    }

    if (!consent) {
      setErrorMessage(
        t.emailConsentError,
      );
      return;
    }

    setLoadingMethod(paymentMethod);

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

              language,

              paymentMethod,
            }),
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            t.orderCreateError,
        );
      }

      if (
        paymentMethod ===
        "bank_transfer"
      ) {
        if (!result.orderId) {
          throw new Error(
            t.orderCreateError,
          );
        }

        const destination =
          language === "en"
            ? `/en/bank-transfer/${encodeURIComponent(
                result.orderId,
              )}`
            : `/bank-transfer/${encodeURIComponent(
                result.orderId,
              )}`;

        window.location.href =
          destination;

        return;
      }

      if (!result.paymentUrl) {
        throw new Error(
          t.paymentLinkError,
        );
      }

      window.location.href =
        result.paymentUrl;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t.orderCreateError,
      );

      setLoadingMethod(null);
    }
  }

  function handleCheckout(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void createOrder("online");
  }

  function handleBankTransfer() {
    void createOrder(
      "bank_transfer",
    );
  }

  const galleryCountText =
    galleryCount === 1
      ? language === "en"
        ? "1 gallery"
        : "1 galéria"
      : language === "en"
        ? `${galleryCount} galleries`
        : `${galleryCount} galérie`;

  const onlineButtonText =
    language === "en"
      ? `PAY ${total} €`
      : `ZAPLATIŤ ${total} €`;

  const bankTransferButtonText =
    language === "en"
      ? `BANK TRANSFER ${total} €`
      : `BANKOVÝ PREVOD ${total} €`;

  const paymentMethodsText =
    language === "en"
      ? "Online payment"
      : "Online platba";

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

          <Link
            href={homeHref}
            className="text-[10px] uppercase tracking-[0.3em] text-white/60 transition hover:text-white md:text-xs"
          >
            ← {t.galleriesNav}
          </Link>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 py-10 md:px-10 md:py-14">
        <div className="border-b border-white/15 pb-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-white/40 md:text-xs">
            LEDON.
          </p>

          <div className="mt-5 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-light uppercase tracking-[0.08em] md:text-6xl">
                {t.cartTitle}
              </h1>

              {count > 0 ? (
                <p className="mt-4 text-xs uppercase tracking-[0.25em] text-white/45">
                  {galleryCountText}
                </p>
              ) : null}
            </div>

            {count > 0 ? (
              <div className="text-left md:text-right">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                  {language === "en" ? "Selected items" : "Vybrané položky"}
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
              {t.cartEmpty}
            </p>

            <Link
              href={homeHref}
              className="mt-10 inline-block bg-white px-8 py-5 text-xs font-semibold uppercase tracking-[0.25em] text-black transition hover:bg-white/80"
            >
              {t.showGalleries}
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
                            item.mediaTitle ?? item.photoId
                          }
                          fill
                          unoptimized={item.gallerySlug.startsWith("slideshow-")}
                          sizes="192px"
                          className="object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base tracking-[0.12em] md:text-xl">
                          {
                            item.mediaTitle ?? item.photoId
                          }
                        </p>

                        <p className="mt-2 truncate text-[10px] uppercase tracking-[0.2em] text-white/40">
                          {
                            item.galleryTitle
                          }
                        </p>

                        <p className="mt-3 text-xl font-light">
                          {item.price} €
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
                        {t.remove}
                      </button>
                    </div>
                  ),
                )}
              </div>

              <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href={homeHref}
                  className="border border-white/25 px-6 py-4 text-center text-[10px] uppercase tracking-[0.22em] text-white/75 transition hover:border-white hover:text-white"
                >
                  ←{" "}
                  {
                    t.continueSelecting
                  }
                </Link>

                <button
                  type="button"
                  onClick={clearCart}
                  disabled={isLoading}
                  className="border border-white/15 px-6 py-4 text-[10px] uppercase tracking-[0.22em] text-white/45 transition hover:border-white/50 hover:text-white disabled:opacity-40"
                >
                  {t.clearCart}
                </button>
              </div>
            </div>

            <aside className="h-fit border border-white/15 bg-[#0d0d0d] p-7 md:p-8">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                {t.summary}
              </p>

              <div className="mt-8 flex items-center justify-between border-b border-white/10 pb-5">
                <span className="text-sm text-white/50">
                  {language === "en" ? "Number of items" : "Počet položiek"}
                </span>

                <span className="text-lg">
                  {count}
                </span>
              </div>

              <div className="flex items-end justify-between border-b border-white/10 py-6">
                <span className="text-sm text-white/50">
                  {t.totalPrice}
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
                  {t.deliveryEmail}
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
                  placeholder="your@email.com"
                  disabled={isLoading}
                  className="mt-3 w-full border border-white/25 bg-black px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white disabled:opacity-50"
                />

                <label className="mt-5 flex cursor-pointer items-start gap-3 text-xs leading-5 text-white/50">
                  <input
                    type="checkbox"
                    checked={consent}
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
                    {t.emailConsent}
                  </span>
                </label>

                {errorMessage ? (
                  <p className="mt-5 text-sm leading-6 text-red-400">
                    {errorMessage}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-7 flex w-full overflow-hidden border border-white bg-white text-black transition hover:bg-white/85 disabled:cursor-wait disabled:opacity-50"
                >
                  <span className="flex min-h-[68px] flex-1 items-center justify-center px-4 text-xs font-semibold uppercase tracking-[0.18em]">
                    {loadingMethod ===
                    "online"
                      ? t.creatingOrder
                      : onlineButtonText}
                  </span>

                  <span className="grid w-[118px] shrink-0 grid-cols-2 gap-x-2 gap-y-1 border-l border-black/15 bg-[#eeeeee] px-3 py-3 text-[8px] font-semibold leading-tight tracking-normal text-black sm:w-[128px]">
                    <span className="flex items-center justify-center whitespace-nowrap">
                      <Image src="/images/payment/apple-pay.svg" alt="Apple Pay" width={42} height={28} unoptimized className="h-7 w-[42px] object-contain" />
                    </span>

                    <span className="flex items-center justify-center whitespace-nowrap">
                      <svg
  width="42" height="28" viewBox="0 0 42 28"
  fill="none" stroke="currentColor" strokeWidth="1.8"
  role="img" aria-label={language === "en" ? "Payment card" : "Platobná karta"}
  className="h-7 w-[42px]"
>
  <rect x="2" y="2" width="38" height="24" rx="4" />
  <path d="M2 9h38M8 19h8M20 19h5" />
</svg>
                    </span>

                    <span className="flex items-center justify-center whitespace-nowrap">
                      <Image src="/images/payment/google-pay.svg" alt="Google Pay" width={42} height={28} unoptimized className="h-7 w-[42px] object-contain" />
                    </span>

                    <span className="flex items-center justify-center whitespace-nowrap">
                      <Image src="/images/payment/revolut.svg" alt="Revolut" width={42} height={28} unoptimized className="h-7 w-[42px] object-contain" />
                    </span>
                  </span>
                </button>

                <p className="mt-3 text-center text-[9px] uppercase tracking-[0.15em] text-white/25">
                  {paymentMethodsText}
                </p>

                <button
                  type="button"
                  onClick={
                    handleBankTransfer
                  }
                  disabled={isLoading}
                  className="mt-4 flex min-h-[62px] w-full items-center justify-center border border-white/30 bg-transparent px-5 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white hover:bg-white hover:text-black disabled:cursor-wait disabled:opacity-50"
                >
                  {loadingMethod ===
                  "bank_transfer"
                    ? t.creatingOrder
                    : bankTransferButtonText}
                </button>
              </form>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}