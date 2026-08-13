"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type CartItem = {
  gallerySlug: string;
  galleryTitle: string;
  photoId: string;
  photoSrc: string;
  price: number;
};

type CartContextType = {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (item: CartItem) => boolean;
  removeItem: (photoId: string) => void;
  clearCart: () => void;
  isInCart: (photoId: string) => boolean;
};

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "ledon-cart";
const CART_EVENT = "ledon-cart-change";
const EMPTY_CART = "[]";

function subscribe(callback: () => void) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot() {
  return (
    window.localStorage.getItem(STORAGE_KEY) ??
    EMPTY_CART
  );
}

function getServerSnapshot() {
  return EMPTY_CART;
}

function parseItems(value: string): CartItem[] {
  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

function saveItems(items: CartItem[]) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items),
  );

  window.dispatchEvent(
    new Event(CART_EVENT),
  );
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const storedCart = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const items = parseItems(storedCart);

  function addItem(item: CartItem) {
    if (
      items.length > 0 &&
      items[0].gallerySlug !== item.gallerySlug
    ) {
      return false;
    }

    const alreadyExists = items.some(
      (cartItem) =>
        cartItem.gallerySlug === item.gallerySlug &&
        cartItem.photoId === item.photoId,
    );

    if (alreadyExists) {
      return true;
    }

    saveItems([
      ...items,
      item,
    ]);

    return true;
  }

  function removeItem(photoId: string) {
    saveItems(
      items.filter(
        (item) => item.photoId !== photoId,
      ),
    );
  }

  function clearCart() {
    saveItems([]);
  }

  function isInCart(photoId: string) {
    return items.some(
      (item) => item.photoId === photoId,
    );
  }

  const count = items.length;

  const total = items.reduce(
    (sum, item) => sum + item.price,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        total,
        addItem,
        removeItem,
        clearCart,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart musí byť použitý vo vnútri CartProvider.",
    );
  }

  return context;
}