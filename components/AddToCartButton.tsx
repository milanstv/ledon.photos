"use client";

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

  const inCart = isInCart(
    gallerySlug,
    photoId,
  );

  function handleClick() {
    if (inCart) {
      removeItem(
        gallerySlug,
        photoId,
      );
      return;
    }

    addItem({
      gallerySlug,
      galleryTitle,
      photoId,
      photoSrc,
      price,
    });
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
    </div>
  );
}