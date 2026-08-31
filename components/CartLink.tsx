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
      <span>Košík</span>

      <span className="inline-flex min-w-10 h-10 items-center justify-center rounded-full border-2 border-white/60 px-3 text-xl font-bold">
       {count}
       </span>
    </Link>
  );
}