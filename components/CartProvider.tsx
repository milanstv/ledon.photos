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
  removeItem: (
    gallerySlug: string,
    photoId: string,
  ) => void;
  clearCart: () => void;
  isInCart: (
    gallerySlug: string,
    photoId: string,
  ) => boolean;
};

const CartContext =
  createContext<CartContextType | null>(
    null,
  );

const STORAGE_KEY = "ledon-cart";
const CART_EVENT =
  "ledon-cart-change";
const EMPTY_CART = "[]";

function subscribe(
  callback: () => void,
) {
  window.addEventListener(
    CART_EVENT,
    callback,
  );

  window.addEventListener(
    "storage",
    callback,
  );

  return () => {
    window.removeEventListener(
      CART_EVENT,
      callback,
    );

    window.removeEventListener(
      "storage",
      callback,
    );
  };
}

function getSnapshot() {
  return (
    window.localStorage.getItem(
      STORAGE_KEY,
    ) ?? EMPTY_CART
  );
}

function getServerSnapshot() {
  return EMPTY_CART;
}

function isValidCartItem(
  value: unknown,
): value is CartItem {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const item =
    value as Partial<CartItem>;

  return (
    typeof item.gallerySlug ===
      "string" &&
    typeof item.galleryTitle ===
      "string" &&
    typeof item.photoId ===
      "string" &&
    typeof item.photoSrc ===
      "string" &&
    typeof item.price === "number" &&
    Number.isFinite(item.price)
  );
}

function parseItems(
  value: string,
): CartItem[] {
  try {
    const parsed =
      JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      isValidCartItem,
    );
  } catch {
    return [];
  }
}

function saveItems(
  items: CartItem[],
) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items),
  );

  window.dispatchEvent(
    new Event(CART_EVENT),
  );
}

function isSameItem(
  first: CartItem,
  gallerySlug: string,
  photoId: string,
) {
  return (
    first.gallerySlug ===
      gallerySlug &&
    first.photoId === photoId
  );
}

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const storedCart =
    useSyncExternalStore(
      subscribe,
      getSnapshot,
      getServerSnapshot,
    );

  const items =
    parseItems(storedCart);

  function addItem(
    item: CartItem,
  ) {
    const alreadyExists =
      items.some(
        (cartItem) =>
          isSameItem(
            cartItem,
            item.gallerySlug,
            item.photoId,
          ),
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

  function removeItem(
    gallerySlug: string,
    photoId: string,
  ) {
    saveItems(
      items.filter(
        (item) =>
          !isSameItem(
            item,
            gallerySlug,
            photoId,
          ),
      ),
    );
  }

  function clearCart() {
    saveItems([]);
  }

  function isInCart(
    gallerySlug: string,
    photoId: string,
  ) {
    return items.some(
      (item) =>
        isSameItem(
          item,
          gallerySlug,
          photoId,
        ),
    );
  }

  const count =
    items.length;

  const total =
    items.reduce(
      (sum, item) =>
        sum + item.price,
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
  const context =
    useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart musí byť použitý vo vnútri CartProvider.",
    );
  }

  return context;
}