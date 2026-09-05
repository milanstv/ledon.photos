"use client";

import { useCart } from "@/components/CartProvider";
import {
  translations,
  type Language,
} from "@/lib/i18n";

type AddToCartButtonProps = {
  gallerySlug: string;
  galleryTitle: string;
  photoId: string;
  photoSrc: string;
  price: number;
  language: Language;
  className?: string;
};

export default function AddToCartButton({
  gallerySlug,
  galleryTitle,
  photoId,
  photoSrc,
  price,
  language,
  className,
}: AddToCartButtonProps) {
  const t = translations[language];

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
          ? t.removeFromCart
          : t.addToCart}
      </button>
    </div>
  );
}