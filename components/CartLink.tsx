"use client";

import Link from "next/link";

import { useCart } from "@/components/CartProvider";

type CartLinkProps = {
  className?: string;
};

export default function CartLink({
  className,
}: CartLinkProps) {
  const { count } = useCart();

  return (
    <Link
      href="/cart"
      className={`${className ?? ""} inline-flex items-center gap-3 text-2xl font-bold`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
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

      <span>Košík</span>

      <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border-2 border-white/60 px-3 text-xl font-bold">
        {count}
      </span>
    </Link>
  );
}