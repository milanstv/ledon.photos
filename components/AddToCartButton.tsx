"use client";

import { useState } from "react";

import { useCart } from "@/components/CartProvider";

type AddToCartButtonProps = {
  gallerySlug: string;
  galleryTitle: string;
  photoId: string;
  photoSrc: string;
  price: number;
  className?: string;
};

export default function AddToCartButton({
  gallerySlug,
  galleryTitle,
  photoId,
  photoSrc,
  price,
  className,
}: AddToCartButtonProps) {
  const {
    addItem,
    removeItem,
    isInCart,
  } = useCart();

  const [error, setError] = useState("");

  const inCart = isInCart(photoId);

  function handleClick() {
    setError("");

    if (inCart) {
      removeItem(photoId);
      return;
    }

    const added = addItem({
      gallerySlug,
      galleryTitle,
      photoId,
      photoSrc,
      price,
    });

    if (!added) {
      setError(
        "Košík už obsahuje fotografie z inej galérie.",
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={className}
      >
        {inCart
          ? "Odobrať z košíka"
          : "Pridať do košíka"}
      </button>

      {error ? (
        <p className="mt-3 text-xs leading-5 text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}