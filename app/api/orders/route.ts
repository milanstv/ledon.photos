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
  photoIds?: unknown;
  email?: unknown;
};

type OrderItem = {
  photoId: string;
  filename: string;
  price: number;
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
  items,
  totalPrice,
}: {
  orderId: string;
  customerEmail: string;
  galleryTitle: string;
  galleryDate: string;
  items: OrderItem[];
  totalPrice: number;
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

  const resend = new Resend(
    resendApiKey,
  );

  const photoList = items
    .map((item) => item.photoId)
    .join(", ");

  const safeGalleryTitle =
    escapeHtml(galleryTitle);

  const safeGalleryDate =
    escapeHtml(galleryDate);

  const safePhotoList =
    escapeHtml(photoList);

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
        `Objednávka ${items.length} fotografií bola prijatá`,
      text: [
        "Dobrý deň,",
        "",
        "vašu objednávku sme prijali.",
        "",
        `Galéria: ${galleryTitle}`,
        `Počet fotografií: ${items.length}`,
        `Fotografie: ${photoList}`,
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
        `Nová objednávka – ${items.length} ks – ${totalPrice} €`,
      text: [
        "Bola vytvorená nová objednávka.",
        "",
        `Galéria: ${galleryTitle}`,
        `Dátum galérie: ${galleryDate}`,
        `Počet fotografií: ${items.length}`,
        `Fotografie: ${photoList}`,
        `Celková cena: ${totalPrice} €`,
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
                Bola vytvorená objednávka fotografií.
              </h1>

              <p style="color:#bbbbbb;line-height:1.8;">
                <strong>Galéria:</strong> ${safeGalleryTitle}<br>
                <strong>Dátum:</strong> ${safeGalleryDate}<br>
                <strong>Počet:</strong> ${items.length}<br>
                <strong>Fotografie:</strong> ${safePhotoList}<br>
                <strong>Cena:</strong> ${totalPrice} €<br>
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

    const email =
      typeof body.email === "string"
        ? body.email
            .trim()
            .toLowerCase()
        : "";

    const photoIds = Array.isArray(
      body.photoIds,
    )
      ? body.photoIds
          .filter(
            (value): value is string =>
              typeof value === "string",
          )
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    if (
      !gallerySlug ||
      photoIds.length === 0 ||
      !email
    ) {
      return NextResponse.json(
        {
          error:
            "Chýbajú fotografie alebo e-mail.",
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

    if (!gallery) {
      return NextResponse.json(
        {
          error:
            "Galéria sa nenašla.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      gallery.price !== 2 &&
      gallery.price !== 5
    ) {
      return NextResponse.json(
        {
          error:
            "Táto galéria nemá podporovanú cenu.",
        },
        {
          status: 400,
        },
      );
    }

    const uniquePhotoIds = [
      ...new Set(photoIds),
    ];

    const items: OrderItem[] = [];

    for (const photoId of uniquePhotoIds) {
      const photoResult =
        getPhoto(
          gallerySlug,
          photoId,
        );

      if (!photoResult) {
        return NextResponse.json(
          {
            error:
              `Fotografia ${photoId} sa nenašla.`,
          },
          {
            status: 404,
          },
        );
      }

      items.push({
        photoId,
        filename:
          photoResult.photo.filename,
        price: gallery.price,
      });
    }

    const count = items.length;

    const totalPrice =
      count * gallery.price;

    let paymentUrl: string | undefined;

    if (count <= 20) {
      const totalInCents =
        Math.round(
          totalPrice * 100,
        );

      paymentUrl =
        process.env[
          `REVOLUT_PAYMENT_LINK_${totalInCents}`
        ];
    } else {
      paymentUrl =
        process.env
          .REVOLUT_PAYMENT_LINK_VOLUNTARY;
    }

    if (!paymentUrl) {
      throw new Error(
        count <= 20
          ? `Chýba Revolut platobný odkaz pre sumu ${totalPrice} €.`
          : "Chýba Revolut voluntary platobný odkaz.",
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

      items,
      count,

      email,

      price: totalPrice,
      unitPrice:
        gallery.price,

      currency: "EUR",

      paymentMode:
        count <= 20
          ? "fixed"
          : "manual",

      expectedAmount:
        totalPrice,

      createdAt: now,
      paidAt: null,
      sentAt: null,
      downloadedAt: null,

      downloadedPhotoIds: [],
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
        items,
        totalPrice,
      });
    } catch (emailError) {
      console.error(
        "Objednávka bola vytvorená, ale e-maily zlyhali:",
        emailError,
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      paymentUrl,
      count,
      unitPrice:
        gallery.price,
      totalPrice,
      paymentMode:
        count <= 20
          ? "fixed"
          : "manual",
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