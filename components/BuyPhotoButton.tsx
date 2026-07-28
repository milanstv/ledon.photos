"use client";

import { useState } from "react";

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

  async function startCheckout() {
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

      window.location.href = data.url;
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
    <div>
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className={className}
      >
        {loading ? "Pripravujem platbu…" : "Kúpiť originál"}
      </button>

      {error && (
        <p className="mt-3 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}