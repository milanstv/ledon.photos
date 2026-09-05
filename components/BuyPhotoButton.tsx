"use client";

import {
  FormEvent,
  useState,
} from "react";
import { usePathname } from "next/navigation";

export default function BuyPhotoButton({
  gallerySlug,
  photoId,
  price,
  className = "",
}: {
  gallerySlug: string;
  photoId: string;
  price: number;
  className?: string;
}) {
  const pathname = usePathname();

  const language =
    pathname.startsWith("/en/")
      ? "en"
      : "sk";

  const text =
    language === "en"
      ? {
          enterEmail:
            "Enter your email address.",
          consentError:
            "Please confirm your consent to the processing of your email address.",
          orderError:
            "The order could not be created.",
          buyPhoto:
            "Buy photo",
          deliveryEmail:
            "Delivery email",
          emailPlaceholder:
            "your@email.com",
          price:
            "Price",
          voluntary:
            "Voluntary",
          amount:
            "amount",
          consent:
            "I agree to the processing of my email address for processing and delivering the order.",
          creatingOrder:
            "Creating order...",
          chooseAmount:
            "Choose amount via Revolut",
          payViaRevolut:
            "Pay via Revolut",
          cancel:
            "Cancel",
        }
      : {
          enterEmail:
            "Zadajte e-mail.",
          consentError:
            "Potvrďte súhlas so spracovaním e-mailu.",
          orderError:
            "Objednávku sa nepodarilo vytvoriť.",
          buyPhoto:
            "Kúpiť fotografiu",
          deliveryEmail:
            "E-mail na doručenie fotografie",
          emailPlaceholder:
            "vas@email.sk",
          price:
            "Cena",
          voluntary:
            "Dobrovoľná",
          amount:
            "suma",
          consent:
            "Súhlasím so spracovaním e-mailu na vybavenie a doručenie objednávky.",
          creatingOrder:
            "Vytváram objednávku...",
          chooseAmount:
            "Zvoliť sumu cez Revolut",
          payViaRevolut:
            "Zaplatiť cez Revolut",
          cancel:
            "Zrušiť",
        };

  const [isOpen, setIsOpen] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [consent, setConsent] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const isVoluntaryPrice =
    price === 0;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage(
        text.enterEmail,
      );
      return;
    }

    if (!consent) {
      setErrorMessage(
        text.consentError,
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
            body:
              JSON.stringify({
                gallerySlug,
                photoId,
                email:
                  email.trim(),
                language,
              }),
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            text.orderError,
        );
      }

      if (!result.paymentUrl) {
        throw new Error(
          text.orderError,
        );
      }

      window.location.href =
        result.paymentUrl;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : text.orderError,
      );

      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() =>
          setIsOpen(true)
        }
        className={
          className
        }
      >
        {text.buyPhoto}
      </button>
    );
  }

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="mt-8 space-y-6"
    >
      <div>
        <label
          htmlFor={`email-${photoId}`}
          className="mb-3 block text-[10px] uppercase tracking-[0.25em] text-white/50"
        >
          {text.deliveryEmail}
        </label>

        <input
          id={`email-${photoId}`}
          type="email"
          value={email}
          onChange={(
            event,
          ) =>
            setEmail(
              event.target.value,
            )
          }
          autoComplete="email"
          placeholder={
            text.emailPlaceholder
          }
          disabled={
            isLoading
          }
          className="w-full border border-white/25 bg-black px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white"
        />
      </div>

      <div>
        <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-white/45">
          {text.price}
        </p>

        <div className="flex items-center gap-6">
          <div className="shrink-0">
            {isVoluntaryPrice ? (
              <>
                <p className="text-2xl font-light leading-none text-white sm:text-3xl">
                  {
                    text.voluntary
                  }
                </p>

                <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-white/45">
                  {text.amount}
                </p>
              </>
            ) : (
              <p className="whitespace-nowrap text-4xl font-light leading-none text-white">
                {price} €
              </p>
            )}
          </div>

          <div className="h-14 w-px shrink-0 bg-white/20" />

          <label className="flex min-w-0 cursor-pointer items-start gap-3 text-xs leading-5 text-white/55">
            <input
              type="checkbox"
              checked={
                consent
              }
              onChange={(
                event,
              ) =>
                setConsent(
                  event.target.checked,
                )
              }
              disabled={
                isLoading
              }
              className="mt-1 h-4 w-4 shrink-0"
            />

            <span>
              {text.consent}
            </span>
          </label>
        </div>
      </div>

      {errorMessage ? (
        <p className="text-sm text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={
          isLoading
        }
        className={
          className
        }
      >
        {isLoading
          ? text.creatingOrder
          : isVoluntaryPrice
            ? text.chooseAmount
            : text.payViaRevolut}
      </button>

      <button
        type="button"
        onClick={() => {
          setIsOpen(false);
          setErrorMessage("");
        }}
        disabled={
          isLoading
        }
        className="w-full py-2 text-[10px] uppercase tracking-[0.25em] text-white/40 transition hover:text-white"
      >
        {text.cancel}
      </button>
    </form>
  );
}