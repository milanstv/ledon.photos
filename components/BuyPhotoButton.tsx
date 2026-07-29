"use client";

import {
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
  useState,
} from "react";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function stopMouseEvent(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function stopPointerEvent(event: PointerEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function stopTouchEvent(event: TouchEvent<HTMLElement>) {
    event.stopPropagation();
  }

  async function startCheckout(
    event: MouseEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (loading) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gallerySlug,
          photoId,
        }),
      });

      const data = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !data.url) {
        throw new Error(
          data.error || "Platbu sa nepodarilo spustiť.",
        );
      }

      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Platbu sa nepodarilo spustiť.",
      );

      setLoading(false);
    }
  }

  return (
    <div
      className="w-full"
      onClick={stopMouseEvent}
      onPointerDown={stopPointerEvent}
      onPointerUp={stopPointerEvent}
      onTouchStart={stopTouchEvent}
      onTouchEnd={stopTouchEvent}
    >
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className={className}
      >
        {loading ? "Pripravujem platbu…" : "Kúpiť originál"}
      </button>

      {error ? (
        <p className="mt-3 text-center text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}