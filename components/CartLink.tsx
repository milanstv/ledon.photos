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
      className={`${className ?? ""} inline-flex items-center gap-2 text-lg font-semibold`}
    >
      <span>Košík</span>

      <span className="inline-flex min-w-7 h-7 items-center justify-center rounded-full border border-white/40 px-2 text-sm">
        {count}
      </span>
    </Link>
  );
}