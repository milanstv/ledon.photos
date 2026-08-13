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
      className={className}
    >
      Košík ({count})
    </Link>
  );
}