"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Language } from "@/lib/i18n";

type BankTransferPageProps = {
  language: Language;
  orderId: string;
  recipient: string;
  bank: string;
  iban: string;
  amount: number;
  variableSymbol: string;
};

type CopyFieldProps = {
  label: string;
  value: string;
  copyText: string;
  copiedText: string;
};

function CopyField({
  label,
  value,
  copyText,
  copiedText,
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="border-b border-white/10 py-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
        {label}
      </p>

      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="min-w-0 break-all text-base text-white md:text-lg">
          {value}
        </p>

        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 border border-white/20 px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-white/60 transition hover:border-white hover:bg-white hover:text-black"
        >
          {copied ? copiedText : copyText}
        </button>
      </div>
    </div>
  );
}

export default function BankTransferPage({
  language,
  orderId,
  recipient,
  bank,
  iban,
  amount,
  variableSymbol,
}: BankTransferPageProps) {
  const isEnglish = language === "en";
  const homeHref = isEnglish ? "/en" : "/";

  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);

  const text = isEnglish
    ? {
        eyebrow: "LEDON. PAYMENT",
        title: "Order created",
        intro:
          "We have also sent the payment details to your email.",
        order: "Order",
        recipient: "Recipient",
        bank: "Bank",
        iban: "IBAN",
        amount: "Amount",
        variableSymbol: "Payment reference",
        copy: "Copy",
        copied: "Copied",
        qrTitle: "PAY BY SQUARE",
        qrText:
          "Scan the QR code in your banking app. The payment details will be filled in automatically.",
        qrLoading: "Creating QR payment...",
        qrError:
          "The QR payment could not be created. Please use the payment details above.",
        notice:
          "Please include the payment reference when making the transfer.",
        delivery:
          "We will send the full-resolution photographs after receiving your payment.",
        back: "Back to galleries",
      }
    : {
        eyebrow: "LEDON. PLATBA",
        title: "Objednávka bola vytvorená",
        intro:
          "Platobné údaje sme vám poslali aj e-mailom.",
        order: "Objednávka",
        recipient: "Príjemca",
        bank: "Banka",
        iban: "IBAN",
        amount: "Suma",
        variableSymbol: "Variabilný symbol",
        copy: "Kopírovať",
        copied: "Skopírované",
        qrTitle: "PAY BY SQUARE",
        qrText:
          "Naskenujte QR kód vo svojej bankovej aplikácii. Údaje o platbe sa vyplnia automaticky.",
        qrLoading: "Vytváram QR platbu...",
        qrError:
          "QR platbu sa nepodarilo vytvoriť. Použite platobné údaje uvedené vyššie.",
        notice:
          "Pri platbe nezabudnite uviesť variabilný symbol.",
        delivery:
          "Originálne súbory vám sprístupníme po prijatí platby.",
        back: "Späť na galérie",
      };

  const formattedAmount = `${amount.toFixed(2).replace(".", ",")} €`;

  useEffect(() => {
    let active = true;

    async function loadQr() {
      try {
        setQrError(false);

        const response = await fetch("/api/bysquare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
          }),
        });

        const result = (await response.json()) as {
          image?: string;
          error?: string;
        };

        if (
          !response.ok ||
          typeof result.image !== "string" ||
          !result.image
        ) {
          throw new Error(
            result.error ?? "QR payment failed.",
          );
        }

        if (active) {
          setQrImage(result.image);
        }
      } catch (error) {
        console.error("PAY by square:", error);

        if (active) {
          setQrError(true);
        }
      }
    }

    loadQr();

    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-5 md:px-10 md:py-7">
        <Link
          href={homeHref}
          className="text-2xl font-bold tracking-[0.12em] md:text-4xl"
        >
          LEDON.
        </Link>

        <Link
          href={homeHref}
          className="text-[10px] uppercase tracking-[0.3em] text-white/60 transition hover:text-white md:text-xs"
        >
          ← {text.back}
        </Link>
      </header>

      <section className="mx-auto w-full max-w-3xl px-5 py-12 md:px-10 md:py-16">
        <p className="text-[10px] uppercase tracking-[0.4em] text-white/40 md:text-xs">
          {text.eyebrow}
        </p>

        <h1 className="mt-5 text-4xl font-light leading-tight md:text-6xl">
          {text.title}
        </h1>

        <p className="mt-6 max-w-2xl text-sm leading-7 text-white/55 md:text-base">
          {text.intro}
        </p>

        <div className="mt-10 border border-white/15 bg-[#0d0d0d] p-6 md:p-8">
          <div className="border-b border-white/10 pb-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              {text.order}
            </p>

            <p className="mt-2 break-all text-sm text-white/65">
              {orderId}
            </p>
          </div>

          <div className="border-b border-white/10 py-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              {text.recipient}
            </p>

            <p className="mt-2 text-lg">{recipient}</p>
          </div>

          <div className="border-b border-white/10 py-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              {text.bank}
            </p>

            <p className="mt-2 text-lg">{bank}</p>
          </div>

          <CopyField
            label={text.iban}
            value={iban}
            copyText={text.copy}
            copiedText={text.copied}
          />

          <CopyField
            label={text.amount}
            value={formattedAmount}
            copyText={text.copy}
            copiedText={text.copied}
          />

          <CopyField
            label={text.variableSymbol}
            value={variableSymbol}
            copyText={text.copy}
            copiedText={text.copied}
          />
        </div>

        <div className="mt-8 border border-white/15 bg-[#0d0d0d] p-6 text-center md:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/55">
            {text.qrTitle}
          </p>

          <div className="mx-auto mt-6 flex aspect-square w-full max-w-[280px] items-center justify-center bg-white p-4">
            {qrImage ? (
              <img
                src={`data:image/png;base64,${qrImage}`}
                alt="PAY by square"
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="px-5 text-xs leading-6 text-black/50">
                {qrError
                  ? text.qrError
                  : text.qrLoading}
              </p>
            )}
          </div>

          <p className="mx-auto mt-5 max-w-md text-xs leading-6 text-white/45">
            {text.qrText}
          </p>
        </div>

        <div className="mt-8 border border-white/15 p-6 md:p-8">
          <p className="text-sm leading-7 text-white/70">
            {text.notice}
          </p>

          <p className="mt-3 text-sm leading-7 text-white/45">
            {text.delivery}
          </p>
        </div>

        <Link
          href={homeHref}
          className="mt-10 inline-block border border-white/25 px-6 py-4 text-[10px] uppercase tracking-[0.22em] text-white/70 transition hover:border-white hover:text-white"
        >
          ← {text.back}
        </Link>
      </section>
    </main>
  );
}