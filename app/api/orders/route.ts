import crypto from "node:crypto";

import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { Resend } from "resend";

import {
  getGallery,
  getPhoto,
} from "@/data/galleries";

import { slideshowOrderItem } from "@/lib/slideshow-commerce";
import { SlideshowError } from "@/lib/slideshow-galleries";

export const runtime = "nodejs";

type Language = "sk" | "en";

type PaymentMethod =
  | "online"
  | "bank_transfer"
  | "revolut"
  | "paypal";

const BANK_TRANSFER = {
  recipient: "Milan Štvrtecký",
  bank: "Tatra banka",
  iban: "SK10 1100 0000 0026 1800 3552",
} as const;

function getVariableSymbolBase(
  date: Date,
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Europe/Bratislava",
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      },
    ).formatToParts(date);

  const value = (
    type: Intl.DateTimeFormatPartTypes,
  ) =>
    parts.find(
      (part) => part.type === type,
    )?.value ?? "00";

  return [
    value("year"),
    value("month"),
    value("day"),
    value("hour"),
    value("minute"),
  ].join("");
}

function isPreconditionFailed(
  error: unknown,
) {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return false;
  }

  const candidate = error as {
    name?: string;
    $metadata?: {
      httpStatusCode?: number;
    };
  };

  return (
    candidate.name ===
      "PreconditionFailed" ||
    candidate.$metadata
      ?.httpStatusCode === 412
  );
}

async function reserveVariableSymbol({
  r2Client,
  bucket,
  orderId,
  createdAt,
}: {
  r2Client: S3Client;
  bucket: string;
  orderId: string;
  createdAt: Date;
}) {
  const base = Number(
    getVariableSymbolBase(createdAt),
  );

  for (
    let offset = 0;
    offset < 1000;
    offset += 1
  ) {
    const variableSymbol = String(
      base + offset,
    ).padStart(10, "0");

    if (variableSymbol.length !== 10) {
      break;
    }

    try {
      await r2Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key:
            `_payment_refs/${variableSymbol}.json`,
          Body: JSON.stringify({
            variableSymbol,
            orderId,
            createdAt:
              createdAt.toISOString(),
          }),
          ContentType:
            "application/json; charset=utf-8",
          CacheControl: "no-store",
          IfNoneMatch: "*",
        }),
      );

      return variableSymbol;
    } catch (error) {
      if (
        isPreconditionFailed(error)
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "Nepodarilo sa vytvoriť jedinečný variabilný symbol.",
  );
}

type RequestedItem = {
  gallerySlug: string;
  photoId: string;
};

type CreateOrderRequest = {
  items?: unknown;

  // Starý formát – ponechávame kvôli kompatibilite.
  gallerySlug?: unknown;
  photoIds?: unknown;

  email?: unknown;
  language?: unknown;
  paymentMethod?: unknown;
};

type OrderItem = {
  itemKey: string;
  gallerySlug: string;
  galleryTitle: string;
  galleryDate: string;
  mediaTitle?: string;
  photoId: string;
  filename: string;
  price: number;
};

const errorTexts = {
  sk: {
    missingItemsOrEmail:
      "Chýbajú položky alebo e-mail.",
    invalidEmail:
      "E-mailová adresa nie je platná.",
    invalidPaymentMethod:
      "Spôsob platby nie je platný.",
    galleryNotFound: (
      gallerySlug: string,
    ) =>
      `Galéria ${gallerySlug} sa nenašla.`,
    unsupportedPrice: (
      galleryTitle: string,
    ) =>
      `Galéria ${galleryTitle} nemá podporovanú cenu.`,
    photoNotFound: (
      photoId: string,
      galleryTitle: string,
    ) =>
      `Fotografia ${photoId} sa v galérii ${galleryTitle} nenašla.`,
    orderCreateError:
      "Objednávku sa nepodarilo vytvoriť. Skús to prosím znova.",
  },

  en: {
    missingItemsOrEmail:
      "Files or email address are missing.",
    invalidEmail:
      "The email address is not valid.",
    invalidPaymentMethod:
      "The payment method is not valid.",
    galleryNotFound: (
      gallerySlug: string,
    ) =>
      `Gallery ${gallerySlug} was not found.`,
    unsupportedPrice: (
      galleryTitle: string,
    ) =>
      `Gallery ${galleryTitle} has an unsupported price.`,
    photoNotFound: (
      photoId: string,
      galleryTitle: string,
    ) =>
      `Photo ${photoId} was not found in gallery ${galleryTitle}.`,
    orderCreateError:
      "We could not create your order. Please try again.",
  },
} as const;

function getR2Client() {
  const accountId =
    process.env.R2_ACCOUNT_ID;

  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID;

  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY;

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey
  ) {
    throw new Error(
      "Chýbajú prihlasovacie údaje Cloudflare R2.",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint:
      `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function isValidEmail(
  email: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
}

function escapeHtml(
  value: string,
) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseNewItems(
  value: unknown,
): RequestedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: RequestedItem[] =
    [];

  for (const rawItem of value) {
    if (
      !rawItem ||
      typeof rawItem !== "object"
    ) {
      continue;
    }

    const item =
      rawItem as {
        gallerySlug?: unknown;
        photoId?: unknown;
      };

    const gallerySlug =
      typeof item.gallerySlug ===
      "string"
        ? item.gallerySlug.trim()
        : "";

    const photoId =
      typeof item.photoId ===
      "string"
        ? item.photoId.trim()
        : "";

    if (
      !gallerySlug ||
      !photoId
    ) {
      continue;
    }

    items.push({
      gallerySlug,
      photoId,
    });
  }

  return items;
}

function parseLegacyItems(
  gallerySlugValue: unknown,
  photoIdsValue: unknown,
): RequestedItem[] {
  const gallerySlug =
    typeof gallerySlugValue ===
    "string"
      ? gallerySlugValue.trim()
      : "";

  if (
    !gallerySlug ||
    !Array.isArray(
      photoIdsValue,
    )
  ) {
    return [];
  }

  return photoIdsValue
    .filter(
      (
        value,
      ): value is string =>
        typeof value ===
        "string",
    )
    .map(
      (photoId) => ({
        gallerySlug,
        photoId:
          photoId.trim(),
      }),
    )
    .filter(
      (item) =>
        Boolean(
          item.photoId,
        ),
    );
}

function deduplicateItems(
  items: RequestedItem[],
) {
  const result:
    RequestedItem[] = [];

  const seen =
    new Set<string>();

  for (const item of items) {
    const itemKey =
      `${item.gallerySlug}:${item.photoId}`;

    if (seen.has(itemKey)) {
      continue;
    }

    seen.add(itemKey);
    result.push(item);
  }

  return result;
}

function getGallerySummary(
  items: OrderItem[],
) {
  const seen =
    new Set<string>();

  const galleries: {
    slug: string;
    title: string;
    date: string;
  }[] = [];

  for (const item of items) {
    if (
      seen.has(
        item.gallerySlug,
      )
    ) {
      continue;
    }

    seen.add(
      item.gallerySlug,
    );

    galleries.push({
      slug:
        item.gallerySlug,
      title:
        item.galleryTitle,
      date:
        item.galleryDate,
    });
  }

  return galleries;
}

async function sendOrderEmails({
  orderId,
  customerEmail,
  items,
  totalPrice,
  language,
  paymentMethod,
  variableSymbol,
}: {
  orderId: string;
  customerEmail: string;
  items: OrderItem[];
  totalPrice: number;
  language: Language;
  paymentMethod: PaymentMethod;
  variableSymbol?: string;
}) {
  const resendApiKey =
    process.env.RESEND_API_KEY;

  const fromEmail =
    process.env.RESEND_FROM_EMAIL;

  const adminEmail =
    process.env.ADMIN_NOTIFICATION_EMAIL;

  if (
    !resendApiKey ||
    !fromEmail ||
    !adminEmail
  ) {
    console.error(
      "Upozorňovacie e-maily neboli odoslané.",
    );

    return;
  }

  const resend =
    new Resend(
      resendApiKey,
    );

  const galleries =
    getGallerySummary(
      items,
    );

  const galleryList =
    galleries
      .map(
        (gallery) =>
          `${gallery.title} (${gallery.date})`,
      )
      .join(", ");

  const photoList =
    items
      .map(
        (item) =>
          `${item.galleryTitle} — ${item.mediaTitle ?? item.photoId}`,
      )
      .join(", ");

  const photoLines =
    items.map(
      (item) =>
        `${item.galleryTitle} — ${item.mediaTitle ?? item.photoId} — ${item.price} €`,
    );

  const safeGalleryList =
    escapeHtml(
      galleryList,
    );

  const safePhotoList =
    escapeHtml(
      photoList,
    );

  const safeOrderId =
    escapeHtml(
      orderId,
    );

  const safeCustomerEmail =
    escapeHtml(
      customerEmail,
    );

  const paymentMethodText =
    paymentMethod ===
      "bank_transfer"
      ? "Bankový prevod"
      : paymentMethod ===
          "paypal"
        ? "PayPal"
        : paymentMethod ===
            "online"
          ? "Online platba"
          : "Revolut";

  const isBankTransfer =
    paymentMethod ===
    "bank_transfer";

  const bankTransferLines =
    isBankTransfer &&
    variableSymbol
      ? [
          `Príjemca: ${BANK_TRANSFER.recipient}`,
          `Banka: ${BANK_TRANSFER.bank}`,
          `IBAN: ${BANK_TRANSFER.iban}`,
          `Suma: ${totalPrice} €`,
          `Variabilný symbol: ${variableSymbol}`,
        ]
      : [];

  const customerEmailResult =
    await resend.emails.send({
      from:
        `LEDON. <${fromEmail}>`,

      to: [
        customerEmail,
      ],

      replyTo:
        fromEmail,

      subject:
        isBankTransfer
          ? language === "en"
            ? `Payment details for your LEDON. order`
            : `Platobné údaje k objednávke LEDON.`
          : language === "en"
            ? `Your order for ${items.length} files has been received`
            : `Objednávka ${items.length} súborov bola prijatá`,

      text:
        language === "en"
          ? isBankTransfer &&
            variableSymbol
            ? [
                "Hello,",
                "",
                "we have received your order.",
                "",
                `Order ID: ${orderId}`,
                "Payment method: Bank transfer",
                "",
                `Galleries: ${galleryList}`,
                `Number of files: ${items.length}`,
                "",
                "Files:",
                ...photoLines,
                "",
                `Total price: ${totalPrice} €`,
                "",
                "Please make the payment using the following bank details:",
                "",
                `Recipient: ${BANK_TRANSFER.recipient}`,
                `Bank: ${BANK_TRANSFER.bank}`,
                `IBAN: ${BANK_TRANSFER.iban}`,
                `Amount: ${totalPrice} €`,
                `Payment reference / variable symbol: ${variableSymbol}`,
                "",
                "Please include the payment reference / variable symbol with your payment.",
                "",
                "Once your payment is received, we will send you an email with links to download the full-resolution originals.",
                "",
                "Thank you for your support.",
                "",
                "LEDON.",
                "https://ledon.photos",
              ].join("\n")
            : [
                "Hello,",
                "",
                "we have received your order.",
                "",
                `Order ID: ${orderId}`,
                `Payment method: ${paymentMethodText}`,
                "",
                `Galleries: ${galleryList}`,
                `Number of files: ${items.length}`,
                "",
                "Files:",
                ...photoLines,
                "",
                `Total price: ${totalPrice} €`,
                "",
                "Once your payment is received, we will send you an email with links to download the full-resolution originals.",
                "",
                "Thank you for your support.",
                "",
                "LEDON.",
                "https://ledon.photos",
              ].join("\n")
          : isBankTransfer &&
              variableSymbol
            ? [
                "Dobrý deň,",
                "",
                "vašu objednávku sme prijali.",
                "",
                `ID objednávky: ${orderId}`,
                "Spôsob platby: Bankový prevod",
                "",
                `Galérie: ${galleryList}`,
                `Počet súborov: ${items.length}`,
                "",
                "Fotografie:",
                ...photoLines,
                "",
                `Celková cena: ${totalPrice} €`,
                "",
                "Platbu prosím odošlite na:",
                "",
                ...bankTransferLines,
                "",
                "Pri platbe prosím uveďte variabilný symbol.",
                "",
                "Po prijatí platby vám odošleme e-mail s odkazmi na stiahnutie originálov v plnom rozlíšení.",
                "",
                "Ďakujeme za podporu.",
                "",
                "LEDON.",
                "https://ledon.photos",
              ].join("\n")
            : [
                "Dobrý deň,",
                "",
                "vašu objednávku sme prijali.",
                "",
                `ID objednávky: ${orderId}`,
                `Spôsob platby: ${paymentMethodText}`,
                "",
                `Galérie: ${galleryList}`,
                `Počet súborov: ${items.length}`,
                "",
                "Fotografie:",
                ...photoLines,
                "",
                `Celková cena: ${totalPrice} €`,
                "",
                "Po prijatí platby vám odošleme e-mail s odkazmi na stiahnutie originálov v plnom rozlíšení.",
                "",
                "Ďakujeme za podporu.",
                "",
                "LEDON.",
                "https://ledon.photos",
              ].join("\n"),
    });

  if (
    customerEmailResult.error
  ) {
    console.error(
      "Nepodarilo sa odoslať potvrdenie zákazníkovi:",
      customerEmailResult.error,
    );
  }

  const photoWord =
    items.length === 1
      ? "foto"
      : items.length >= 2 &&
          items.length <= 4
        ? "fotky"
        : "fotiek";

  const galleryWord =
    galleries.length >= 2 &&
    galleries.length <= 4
      ? "galérie"
      : "galérií";

  const adminSummary =
    galleries.length === 1
      ? `${galleries[0].title} (${galleries[0].date}) • ${items.length} ${photoWord} • ${totalPrice} €`
      : `${galleries.length} ${galleryWord} • ${items.length} ${photoWord} • ${totalPrice} €`;

  const safeAdminSummary =
    escapeHtml(
      adminSummary,
    );

  const adminPreview =
    `${adminSummary} • Zákazník: ${customerEmail} • ${paymentMethodText}`;

  const safeAdminPreview =
    escapeHtml(
      adminPreview,
    );

  const adminBankText =
    isBankTransfer &&
    variableSymbol
      ? [
          "",
          "Platba: BANKOVÝ PREVOD",
          `Variabilný symbol: ${variableSymbol}`,
          `Suma: ${totalPrice} €`,
        ]
      : [];

  const adminBankHtml =
    isBankTransfer &&
    variableSymbol
      ? `
        <div style="margin-top:24px;padding:18px;border:1px solid #3b3b3b;background:#181818;">
          <p style="margin:0 0 10px;color:#ffffff;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
            Bankový prevod
          </p>
          <p style="margin:0;color:#bbbbbb;line-height:1.8;">
            <strong>Variabilný symbol:</strong> ${escapeHtml(variableSymbol)}<br>
            <strong>Suma:</strong> ${totalPrice} €<br>
            <strong>Stav:</strong> Čaká na platbu
          </p>
        </div>
      `
      : "";

  const adminEmailResult =
    await resend.emails.send({
      from:
        `LEDON. <${fromEmail}>`,

      to: [
        adminEmail,
      ],

      replyTo:
        customerEmail,

      subject:
        `Nová objednávka – ${items.length} ks – ${totalPrice} € – ${paymentMethodText}`,

      text: [
        adminSummary,
        "",
        `Galérie: ${galleryList}`,
        `Počet: ${items.length}`,
        `Fotografie: ${photoList}`,
        `Cena: ${totalPrice} €`,
        `Zákazník: ${customerEmail}`,
        `ID objednávky: ${orderId}`,
        ...adminBankText,
        "",
        "Otvoriť objednávky:",
        "https://ledon.photos/admin/orders",
      ].join("\n"),

      html: `
        <!doctype html>
        <html lang="sk">
          <body style="margin:0;padding:30px;background:#080808;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">

            <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
              ${safeAdminPreview}
            </div>

            <div style="max-width:620px;margin:0 auto;background:#111111;border:1px solid #303030;padding:36px;">

              <div style="font-size:26px;font-weight:700;letter-spacing:4px;">
                LEDON.
              </div>

              <p style="margin:28px 0 8px;color:#999999;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
                Nová objednávka
              </p>

              <p style="margin:0 0 28px;font-size:16px;line-height:1.5;font-weight:400;color:#ffffff;">
                ${safeAdminSummary}
              </p>

              <p style="color:#bbbbbb;line-height:1.8;">
                <strong>Galérie:</strong> ${safeGalleryList}<br>
                <strong>Počet:</strong> ${items.length}<br>
                <strong>Fotografie:</strong> ${safePhotoList}<br>
                <strong>Cena:</strong> ${totalPrice} €<br>
                <strong>Platba:</strong> ${escapeHtml(paymentMethodText)}<br>
                <strong>Zákazník:</strong>
                <a
                  href="mailto:${safeCustomerEmail}"
                  style="color:#ffffff !important;text-decoration:none;"
                >
                  ${safeCustomerEmail}
                </a><br>
                <strong>ID objednávky:</strong> ${safeOrderId}
              </p>

              ${adminBankHtml}

              <a
                href="https://ledon.photos/admin/orders"
                style="display:block;margin-top:30px;background:#ffffff;color:#000000;text-decoration:none;text-align:center;padding:18px 24px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;"
              >
                Otvoriť objednávky
              </a>

            </div>
          </body>
        </html>
      `,
    });

  if (
    adminEmailResult.error
  ) {
    console.error(
      "Nepodarilo sa odoslať upozornenie administrátorovi:",
      adminEmailResult.error,
    );
  }
}

export async function POST(
  request: Request,
) {
  let language: Language =
    "sk";

  try {
    const body =
      (await request.json()) as CreateOrderRequest;

    language =
      body.language === "en"
        ? "en"
        : "sk";

    const t =
      errorTexts[language];

    const paymentMethod:
      PaymentMethod =
      body.paymentMethod ===
      "bank_transfer"
        ? "bank_transfer"
        : body.paymentMethod ===
            "online"
          ? "online"
          : body.paymentMethod ===
              "paypal"
            ? "paypal"
            : "revolut";

    if (
      body.paymentMethod !==
        undefined &&
      body.paymentMethod !==
        "online" &&
      body.paymentMethod !==
        "bank_transfer" &&
      body.paymentMethod !==
        "revolut" &&
      body.paymentMethod !==
        "paypal"
    ) {
      return NextResponse.json(
        {
          error:
            t.invalidPaymentMethod,
        },
        {
          status: 400,
        },
      );
    }

    const email =
      typeof body.email ===
      "string"
        ? body.email
            .trim()
            .toLowerCase()
        : "";

    const newItems =
      parseNewItems(
        body.items,
      );

    const legacyItems =
      parseLegacyItems(
        body.gallerySlug,
        body.photoIds,
      );

    const requestedItems =
      deduplicateItems(
        newItems.length > 0
          ? newItems
          : legacyItems,
      );

    if (
      requestedItems.length ===
        0 ||
      !email
    ) {
      return NextResponse.json(
        {
          error:
            t.missingItemsOrEmail,
        },
        {
          status: 400,
        },
      );
    }

    if (
      !isValidEmail(
        email,
      )
    ) {
      return NextResponse.json(
        {
          error:
            t.invalidEmail,
        },
        {
          status: 400,
        },
      );
    }

    const items:
      OrderItem[] = [];

    for (
      const requestedItem
      of requestedItems
    ) {
      if (requestedItem.gallerySlug.startsWith("slideshow-")) {
        const item = await slideshowOrderItem(requestedItem.gallerySlug, requestedItem.photoId);
        if (!item) throw new SlideshowError("Slideshow sa nenašlo.", 404);
        items.push(item);
        continue;
      }
      const gallery =
        getGallery(
          requestedItem.gallerySlug,
        );

      if (!gallery) {
        return NextResponse.json(
          {
            error:
              t.galleryNotFound(
                requestedItem.gallerySlug,
              ),
          },
          {
            status: 404,
          },
        );
      }

      if (
        gallery.price !== 2 &&
        gallery.price !== 4 &&
        gallery.price !== 5
      ) {
        return NextResponse.json(
          {
            error:
              t.unsupportedPrice(
                gallery.title,
              ),
          },
          {
            status: 400,
          },
        );
      }

      const photoResult =
        getPhoto(
          requestedItem.gallerySlug,
          requestedItem.photoId,
        );

      if (!photoResult) {
        return NextResponse.json(
          {
            error:
              t.photoNotFound(
                requestedItem.photoId,
                gallery.title,
              ),
          },
          {
            status: 404,
          },
        );
      }

      items.push({
        itemKey:
          `${gallery.slug}:${requestedItem.photoId}`,

        gallerySlug:
          gallery.slug,

        galleryTitle:
          gallery.title,

        galleryDate:
          gallery.date,

        photoId:
          requestedItem.photoId,

        filename:
          photoResult.photo
            .filename,

        price:
          gallery.price,
      });
    }

    const count =
      items.length;

    const totalPrice =
      items.reduce(
        (sum, item) =>
          sum + Math.round(item.price * 100),
        0,
      ) / 100;

    const totalInCents =
      Math.round(
        totalPrice * 100,
      );

    let paymentMode:
      "fixed" | "manual";

    let paymentUrl:
      string | null = null;

    if (
      paymentMethod ===
        "revolut" ||
      paymentMethod ===
        "online"
    ) {
      const fixedPaymentUrl =
        count <= 20
          ? process.env[
              `REVOLUT_PAYMENT_LINK_${totalInCents}`
            ]
          : undefined;

      const voluntaryPaymentUrl =
        process.env
          .REVOLUT_PAYMENT_LINK_VOLUNTARY;

      paymentMode =
        fixedPaymentUrl
          ? "fixed"
          : "manual";

      paymentUrl =
        fixedPaymentUrl ??
        voluntaryPaymentUrl ??
        null;

      if (!paymentUrl) {
        throw new Error(
          "Chýba Revolut platobný odkaz.",
        );
      }
    } else if (
      paymentMethod ===
      "bank_transfer"
    ) {
      paymentMode =
        "fixed";
    } else {
      paymentMode =
        "manual";
    }

    const ordersBucket =
      process.env
        .R2_ORIGINALS_BUCKET;

    if (!ordersBucket) {
      throw new Error(
        "Chýba R2_ORIGINALS_BUCKET.",
      );
    }

    const orderId =
      crypto.randomUUID();

    const createdAt =
      new Date();

    const now =
      createdAt.toISOString();

    const r2Client =
      getR2Client();

    const variableSymbol =
      paymentMethod ===
      "bank_transfer"
        ? await reserveVariableSymbol({
            r2Client,
            bucket:
              ordersBucket,
            orderId,
            createdAt,
          })
        : undefined;

    const galleries =
      getGallerySummary(
        items,
      );

    const firstGallery =
      galleries[0];

    const allPrices =
      items.map(
        (item) =>
          item.price,
      );

    const unitPrice =
      allPrices.every(
        (price) =>
          price ===
          allPrices[0],
      )
        ? allPrices[0]
        : undefined;

    const order = {
      id:
        orderId,

      status:
        "waiting_payment",

      language,

      paymentMethod,

      ...(variableSymbol
        ? {
            variableSymbol,
            bankTransfer:
              BANK_TRANSFER,
          }
        : {}),

      // Ponechávame kvôli kompatibilite so starými časťami systému.
      // Pri novej multi-gallery objednávke je to prvá galéria.
      gallerySlug:
        firstGallery.slug,

      galleryTitle:
        firstGallery.title,

      galleryDate:
        firstGallery.date,

      galleries,
      items,
      count,
      email,

      price:
        totalPrice,

      ...(unitPrice !==
      undefined
        ? {
            unitPrice,
          }
        : {}),

      currency:
        "EUR",

      paymentMode,

      expectedAmount:
        totalPrice,

      createdAt:
        now,

      paidAt:
        null,

      sentAt:
        null,

      downloadedAt:
        null,

      downloadedPhotoIds:
        [],

      downloadedItemKeys:
        [],
    };

    const orderKey =
      `_orders/${orderId}.json`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket:
          ordersBucket,

        Key:
          orderKey,

        Body:
          JSON.stringify(
            order,
            null,
            2,
          ),

        ContentType:
          "application/json; charset=utf-8",

        CacheControl:
          "no-store",
      }),
    );

    try {
      await sendOrderEmails({
        orderId,

        customerEmail:
          email,

        items,

        totalPrice,

        language,

        paymentMethod,
        variableSymbol,
      });
    } catch (
      emailError
    ) {
      console.error(
        "Objednávka bola vytvorená, ale e-maily zlyhali:",
        emailError,
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      paymentMethod,
      paymentUrl,
      count,
      totalPrice,
      paymentMode,
      variableSymbol,

      ...(paymentMethod ===
      "bank_transfer"
        ? {
            bankTransfer:
              BANK_TRANSFER,
          }
        : {}),

      ...(unitPrice !==
      undefined
        ? {
            unitPrice,
          }
        : {}),
    });
  } catch (
    error
  ) {
    if (error instanceof SlideshowError) return NextResponse.json({ error: language === "en" ? "This slideshow is unavailable. Remove it from your cart and refresh the gallery." : error.message }, { status: error.status });
    console.error(
      "Chyba pri vytváraní objednávky:",
      error,
    );

    return NextResponse.json(
      {
        error:
          errorTexts[
            language
          ].orderCreateError,
      },
      {
        status: 500,
      },
    );
  }
}