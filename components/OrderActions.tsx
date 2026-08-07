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

  async function deleteOrder() {
    const confirmed = window.confirm(
      "Naozaj chcete vymazať túto objednávku?\n\nTáto akcia je nevratná.",
    );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/delete`,
        {
          method: "DELETE",
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Objednávku sa nepodarilo vymazať.",
        );
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Objednávku sa nepodarilo vymazať.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ActionContainer
      errorMessage={errorMessage}
      successMessage={successMessage}
    >
      {status === "waiting_payment" ? (
        <button
          type="button"
          onClick={confirmPayment}
          disabled={isLoading}
          className="whitespace-nowrap bg-white px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading
            ? "Potvrdzujem..."
            : "Platba prijatá"}
        </button>
      ) : null}

      {status === "paid" ? (
        <button
          type="button"
          onClick={sendOriginal}
          disabled={isLoading}
          className="whitespace-nowrap bg-white px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading
            ? "Odosielam..."
            : "Odoslať originál"}
        </button>
      ) : null}

      {status === "sent" ? (
        <button
          type="button"
          onClick={sendOriginal}
          disabled={isLoading}
          className="whitespace-nowrap bg-white px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading
            ? "Odosielam..."
            : "Poslať nový odkaz"}
        </button>
      ) : null}

      {status === "downloaded" ? (
        <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.22em] text-white/45">
          Originál bol stiahnutý
        </p>
      ) : null}

      <button
        type="button"
        onClick={deleteOrder}
        disabled={isLoading}
        className="whitespace-nowrap border border-red-500/40 px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-red-400 transition hover:border-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Vymazať
      </button>
    </ActionContainer>
  );
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
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {children}
      </div>

      {successMessage ? (
        <p className="max-w-[260px] text-xs leading-5 text-green-400">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="max-w-[260px] text-xs leading-5 text-red-400">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}