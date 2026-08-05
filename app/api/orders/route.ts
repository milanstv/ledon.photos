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

export const runtime = "nodejs";

type CreateOrderRequest = {
  gallerySlug?: unknown;
  photoId?: unknown;
  email?: unknown;
};

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
      `https://${accountId}` +
      ".r2.cloudflarestorage.com",
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendOrderEmails({
  orderId,
  customerEmail,
  galleryTitle,
  galleryDate,
  photoId,
  price,
}: {
  orderId: string;
  customerEmail: string;
  galleryTitle: string;
  galleryDate: string;
  photoId: string;
  price: number;
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
      "Upozorňovacie e-maily neboli odoslané. Chýba RESEND_API_KEY, RESEND_FROM_EMAIL alebo ADMIN_NOTIFICATION_EMAIL.",
    );

    return;
  }

  const resend = new Resend(
    resendApiKey,
  );

  const safeGalleryTitle =
    escapeHtml(galleryTitle);

  const safeGalleryDate =
    escapeHtml(galleryDate);

  const safePhotoId =
    escapeHtml(photoId);

  const safeOrderId =
    escapeHtml(orderId);

  const safeCustomerEmail =
    escapeHtml(customerEmail);

  const customerEmailResult =
    await resend.emails.send({
      from: `LEDON. <${fromEmail}>`,
      to: [customerEmail],
      replyTo: fromEmail,
      subject:
        `Objednávka fotografie ${photoId} bola prijatá`,
      text: [
        "Dobrý deň,",
        "",
        "vašu objednávku fotografie sme prijali.",
        "",
        `Fotografia: ${photoId}`,
        `Galéria: ${galleryTitle}`,
        `Cena: ${price} €`,
        "",
        "Po prijatí platby vám odošleme e-mail s odkazom na stiahnutie originálu v plnom rozlíšení.",
        "",
        "Ďakujeme za podporu.",
        "",
        "LEDON.",
        "https://ledon.photos",
      ].join("\n"),
    });

  if (customerEmailResult.error) {
    console.error(
      "Nepodarilo sa odoslať potvrdenie zákazníkovi:",
      customerEmailResult.error,
    );
  }

  const adminEmailResult =
    await resend.emails.send({
      from: `LEDON. <${fromEmail}>`,
      to: [adminEmail],
      replyTo: customerEmail,
      subject:
        `Nová objednávka – ${photoId} – ${price} €`,
      text: [
        "Bola vytvorená nová objednávka fotografie.",
        "",
        `Fotografia: ${photoId}`,
        `Galéria: ${galleryTitle}`,
        `Dátum galérie: ${galleryDate}`,
        `Cena: ${price} €`,
        `Zákazník: ${customerEmail}`,
        `Objednávka: ${orderId}`,
        "",
        "Po prijatí platby otvor administráciu:",
        "https://ledon.photos/admin/orders",
      ].join("\n"),
      html: `
        <!doctype html>
        <html lang="sk">
          <body style="margin:0;padding:30px;background:#080808;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
            <div style="max-width:620px;margin:0 auto;background:#111111;border:1px solid #303030;padding:36px;">
              <div style="font-size:26px;font-weight:700;letter-spacing:4px;">
                LEDON.
              </div>

              <p style="margin:28px 0 8px;color:#999999;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
                Nová objednávka
              </p>

              <h1 style="margin:0 0 28px;font-size:26px;font-weight:400;">
                Bola vytvorená požiadavka na kúpu fotografie.
              </h1>

              <p style="color:#bbbbbb;line-height:1.8;">
                <strong>Fotografia:</strong> ${safePhotoId}<br>
                <strong>Galéria:</strong> ${safeGalleryTitle}<br>
                <strong>Dátum:</strong> ${safeGalleryDate}<br>
                <strong>Cena:</strong> ${price} €<br>
                <strong>Zákazník:</strong> ${safeCustomerEmail}<br>
                <strong>ID objednávky:</strong> ${safeOrderId}
              </p>

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

  if (adminEmailResult.error) {
    console.error(
      "Nepodarilo sa odoslať upozornenie administrátorovi:",
      adminEmailResult.error,
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as CreateOrderRequest;

    const gallerySlug =
      typeof body.gallerySlug === "string"
        ? body.gallerySlug.trim()
        : "";

    const photoId =
      typeof body.photoId === "string"
        ? body.photoId.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email
            .trim()
            .toLowerCase()
        : "";

    if (
      !gallerySlug ||
      !photoId ||
      !email
    ) {
      return NextResponse.json(
        {
          error:
            "Chýba fotografia alebo e-mail.",
        },
        {
          status: 400,
        },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          error:
            "E-mailová adresa nie je platná.",
        },
        {
          status: 400,
        },
      );
    }

    const gallery =
      getGallery(gallerySlug);

    const photoResult =
      getPhoto(
        gallerySlug,
        photoId,
      );

    if (!gallery || !photoResult) {
      return NextResponse.json(
        {
          error:
            "Fotografia sa nenašla.",
        },
        {
          status: 404,
        },
      );
    }

    const priceInCents =
      Math.round(
        gallery.price * 100,
      );

    const paymentUrl =
      process.env[
        `REVOLUT_PAYMENT_LINK_${priceInCents}`
      ];

    if (!paymentUrl) {
      throw new Error(
        `Chýba Revolut platobný odkaz pre cenu ${gallery.price} €.`,
      );
    }

    const ordersBucket =
      process.env.R2_ORIGINALS_BUCKET;

    if (!ordersBucket) {
      throw new Error(
        "Chýba R2_ORIGINALS_BUCKET.",
      );
    }

    const orderId =
      crypto.randomUUID();

    const now =
      new Date().toISOString();

    const order = {
      id: orderId,
      status: "waiting_payment",
      gallerySlug,
      galleryTitle:
        gallery.title,
      galleryDate:
        gallery.date,
      photoId,
      filename:
        photoResult.photo.filename,
      email,
      price: gallery.price,
      currency: "EUR",
      createdAt: now,
      paidAt: null,
      sentAt: null,
      downloadedAt: null,
    };

    const orderKey =
      `_orders/${orderId}.json`;

    const r2Client =
      getR2Client();

    await r2Client.send(
      new PutObjectCommand({
        Bucket: ordersBucket,
        Key: orderKey,
        Body: JSON.stringify(
          order,
          null,
          2,
        ),
        ContentType:
          "application/json; charset=utf-8",
        CacheControl: "no-store",
      }),
    );

    try {
      await sendOrderEmails({
        orderId,
        customerEmail: email,
        galleryTitle:
          gallery.title,
        galleryDate:
          gallery.date,
        photoId,
        price: gallery.price,
      });
    } catch (emailError) {
      console.error(
        "Objednávka bola vytvorená, ale upozorňovacie e-maily zlyhali:",
        emailError,
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      paymentUrl,
    });
  } catch (error) {
    console.error(
      "Chyba pri vytváraní objednávky:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Objednávku sa nepodarilo vytvoriť.",
      },
      {
        status: 500,
      },
    );
  }
}