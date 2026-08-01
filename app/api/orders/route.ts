import crypto from "node:crypto";

import {
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

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
        ? body.email.trim().toLowerCase()
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
      getPhoto(gallerySlug, photoId);

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

    const priceInCents = Math.round(
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
      galleryTitle: gallery.title,
      galleryDate: gallery.date,
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