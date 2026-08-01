"use client";

import { FormEvent, useState } from "react";

type BuyPhotoButtonProps = {
  gallerySlug: string;
  photoId: string;
  className?: string;
};

export default function BuyPhotoButton({
  gallerySlug,
  photoId,
  className = "",
}: BuyPhotoButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!email.trim()) {
      setErrorMessage("Zadajte e-mail.");
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
      const response = await fetch(
        "/api/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            gallerySlug,
            photoId,
            email: email.trim(),
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Objednávku sa nepodarilo vytvoriť.",
        );
      }

      window.location.href = result.paymentUrl;
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Objednávku sa nepodarilo vytvoriť.",
      );

      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        Kúpiť fotografiu
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-4"
    >
      <div>
        <label
          htmlFor={`email-${photoId}`}
          className="mb-2 block text-[10px] uppercase tracking-[0.25em] text-white/50"
        >
          E-mail na doručenie fotografie
        </label>

        <input
          id={`email-${photoId}`}
          type="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          autoComplete="email"
          placeholder="vas@email.sk"
          disabled={isLoading}
          className="w-full border border-white/25 bg-black px-4 py-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white"
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-white/55">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) =>
            setConsent(event.target.checked)
          }
          disabled={isLoading}
          className="mt-1 h-4 w-4"
        />

        <span>
          Súhlasím so spracovaním e-mailu na
          vybavenie a doručenie objednávky.
        </span>
      </label>

      {errorMessage ? (
        <p className="text-sm text-red-400">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className={className}
      >
        {isLoading
          ? "Vytváram objednávku..."
          : "Zaplatiť cez Revolut"}
      </button>

      <button
        type="button"
        onClick={() => {
          setIsOpen(false);
          setErrorMessage("");
        }}
        disabled={isLoading}
        className="w-full py-2 text-[10px] uppercase tracking-[0.25em] text-white/40 transition hover:text-white"
      >
        Zrušiť
      </button>
    </form>
  );
}