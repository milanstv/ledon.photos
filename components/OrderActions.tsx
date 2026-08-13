"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OrderActionsProps = {
  orderId: string;
  status: string;
  email: string;
  photoLabel: string;
  count: number;

  paymentMode?: "fixed" | "manual";
  expectedAmount?: number;
  unitPrice?: number;
};

export default function OrderActions({
  orderId,
  status,
  email,
  photoLabel,
  count,
  paymentMode,
  expectedAmount,
  unitPrice,
}: OrderActionsProps) {
  const router = useRouter();

  const [receivedAmount, setReceivedAmount] =
    useState(
      expectedAmount?.toString() ??
        "",
    );

  const [isLoading, setIsLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const isManual =
    paymentMode === "manual";

  const receivedNumber =
    Number(
      receivedAmount.replace(
        ",",
        ".",
      ),
    );

  const calculatedPaidCount =
    isManual &&
    unitPrice &&
    Number.isFinite(
      receivedNumber,
    )
      ? Math.min(
          count,
          Math.max(
            0,
            Math.floor(
              (receivedNumber +
                0.000001) /
                unitPrice,
            ),
          ),
        )
      : count;

  const unpaidCount =
    count -
    calculatedPaidCount;

  async function confirmPayment() {
    if (
      isManual &&
      (!Number.isFinite(
        receivedNumber,
      ) ||
        receivedNumber <= 0)
    ) {
      setErrorMessage(
        "Zadaj skutočne prijatú sumu.",
      );
      return;
    }

    const confirmed =
      window.confirm(
        isManual
          ? [
              `Očakávaná suma: ${expectedAmount} €`,
              `Prijatá suma: ${receivedNumber} €`,
              `Zaplatených fotografií: ${calculatedPaidCount} z ${count}`,
              "",
              "Potvrdiť prijatie platby?",
            ].join("\n")
          : `Potvrdzuješ, že platba za ${count} fotografií prišla na Revolut?`,
      );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
          `/api/admin/orders/${orderId}/paid`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                receivedAmount:
                  isManual
                    ? receivedNumber
                    : undefined,
              }),
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
    const confirmed =
      window.confirm(
        count === 1
          ? `Odoslať fotografiu ${photoLabel} na ${email}?`
          : `Odoslať zaplatené fotografie na ${email}?`,
      );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
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
    const confirmed =
      window.confirm(
        "Naozaj chcete vymazať túto objednávku?\n\nTáto akcia je nevratná.",
      );

    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response =
        await fetch(
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
      errorMessage={
        errorMessage
      }
      successMessage={
        successMessage
      }
    >
      {status ===
      "waiting_payment" ? (
        <>
          {isManual ? (
            <div className="w-[260px] border border-yellow-400/30 bg-yellow-400/5 p-4">
              <p className="text-[9px] uppercase tracking-[0.2em] text-yellow-300">
                Manuálna platba
              </p>

              <p className="mt-3 text-xs text-white/45">
                Očakávané
              </p>

              <p className="mt-1 text-lg">
                {expectedAmount} €
              </p>

              <label className="mt-4 block text-[9px] uppercase tracking-[0.2em] text-white/45">
                Skutočne prijaté
              </label>

              <div className="mt-2 flex items-center">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    receivedAmount
                  }
                  onChange={(
                    event,
                  ) =>
                    setReceivedAmount(
                      event.target
                        .value,
                    )
                  }
                  disabled={
                    isLoading
                  }
                  className="w-full border border-white/25 bg-black px-3 py-3 text-sm text-white outline-none focus:border-white"
                />

                <span className="ml-2">
                  €
                </span>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4 text-xs leading-6">
                <p className="text-white/50">
                  Zaplatených:{" "}
                  <strong className="text-white">
                    {
                      calculatedPaidCount
                    }{" "}
                    / {count}
                  </strong>
                </p>

                {unpaidCount >
                0 ? (
                  <p className="text-red-400">
                    Nezaplatených:{" "}
                    {unpaidCount}
                  </p>
                ) : (
                  <p className="text-green-400">
                    Suma je správna.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={
              confirmPayment
            }
            disabled={
              isLoading
            }
            className="whitespace-nowrap bg-white px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-black transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading
              ? "Potvrdzujem..."
              : "Platba prijatá"}
          </button>
        </>
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
            : count === 1
              ? "Odoslať originál"
              : "Odoslať originály"}
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

      {status ===
      "downloaded" ? (
        <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.22em] text-white/45">
          Originály boli
          stiahnuté
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
      <div className="flex flex-wrap items-start gap-3">
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