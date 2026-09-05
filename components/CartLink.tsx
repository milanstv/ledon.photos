"use client";

import Link from "next/link";

import { useCart } from "@/components/CartProvider";
import type { Language } from "@/lib/i18n";

type CartLinkProps = {
  language: Language;
  className?: string;
};

export default function CartLink({
  language,
  className,
}: CartLinkProps) {
  const { count } = useCart();

  const cartHref =
    language === "en"
      ? "/en/cart"
      : "/cart";

  return (
    <Link
      href={cartHref}
      className={`${className ?? ""} inline-flex items-center gap-2`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="20" r="1" />
        <circle cx="19" cy="20" r="1" />
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H6" />
      </svg>

      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white/60 px-3 text-xl font-bold">
        {count}
      </span>
    </Link>
  );
}