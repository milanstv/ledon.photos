"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OrderActionsProps = {
  orderId: string;
  status: string;
  email: string;
  photoId: string;
};

export default function OrderActions({
  orderId,
  status,
  email,
  photoId,
}: OrderActionsProps) {
  const router = useRouter();

  const [isLoading, setIsLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  async function confirmPayment() {
    const confirmed = window.confirm(
      "Potvrdzuješ, že platba za túto fotografiu prišla na Revolut?",
    );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/paid`,
        {
          method: "POST",
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Platbu sa nepodarilo potvrdiť.",
        );
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Platbu sa nepodarilo potvrdiť.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function sendOriginal() {
    const confirmed = window.confirm(
      `Odoslať fotografiu ${photoId} na ${email}?`,
    );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/send`,
        {
          method: "POST",
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "E-mail sa nepodarilo odoslať.",
        );
      }

      setSuccessMessage(
        result.message ??
          "E-mail bol odoslaný.",
      );

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "E-mail sa nepodarilo odoslať.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (status === "waiting_payment") {
    return (
      <ActionContainer
        errorMessage={errorMessage}
        successMessage={successMessage}
      >
        <button
          type="button"
          onClick={confirmPayment}
          disabled={isLoading}
          className="whitespace-nowrap border border-white bg-white px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-white/80 disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading
            ? "Potvrdzujem..."
            : "Platba prijatá"}
        </button>
      </ActionContainer>
    );
  }

  if (status === "paid") {
    return (
      <ActionContainer
        errorMessage={errorMessage}
        successMessage={successMessage}
      >
        <button
          type="button"
          onClick={sendOriginal}
          disabled={isLoading}
          className="whitespace-nowrap border border-white bg-white px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-black transition hover:bg-white/80 disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading
            ? "Odosielam..."
            : "Odoslať originál"}
        </button>
      </ActionContainer>
    );
  }

  if (status === "sent") {
    return (
      <ActionContainer
        errorMessage={errorMessage}
        successMessage={successMessage}
      >
        <button
          type="button"
          onClick={sendOriginal}
          disabled={isLoading}
          className="whitespace-nowrap border border-white/30 px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-white transition hover:border-white disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading
            ? "Odosielam..."
            : "Poslať nový odkaz"}
        </button>
      </ActionContainer>
    );
  }

  if (status === "downloaded") {
    return (
      <span className="text-xs text-white/45">
        Originál bol stiahnutý
      </span>
    );
  }

  return null;
}

function ActionContainer({
  children,
  errorMessage,
  successMessage,
}: {
  children: React.ReactNode;
  errorMessage: string;
  successMessage: string;
}) {
  return (
    <div className="space-y-2">
      {children}

      {successMessage ? (
        <p className="max-w-[240px] text-xs leading-5 text-green-400">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="max-w-[240px] text-xs leading-5 text-red-400">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}