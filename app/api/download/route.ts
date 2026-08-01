import crypto from "node:crypto";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Order = {
  id: string;
  status: string;
  gallerySlug: string;
  galleryTitle: string;
  galleryDate: string;
  photoId: string;
  filename: string;
  email: string;
  price: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  sentAt: string | null;
  downloadedAt: string | null;
  downloadTokenHash?: string | null;
  downloadExpiresAt?: string | null;
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

function createTokenHash(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function tokensMatch(
  savedHash: string,
  receivedToken: string,
) {
  const receivedHash =
    createTokenHash(receivedToken);

  const savedBuffer =
    Buffer.from(savedHash, "hex");

  const receivedBuffer =
    Buffer.from(receivedHash, "hex");

  if (
    savedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    savedBuffer,
    receivedBuffer,
  );
}

export async function GET(
  request: Request,
) {
  try {
    const requestUrl =
      new URL(request.url);

    const orderId =
      requestUrl.searchParams
        .get("orderId")
        ?.trim();

    const token =
      requestUrl.searchParams
        .get("token")
        ?.trim();

    if (!orderId || !token) {
      return NextResponse.json(
        {
          error:
            "Odkaz na stiahnutie nie je platný.",
        },
        {
          status: 400,
        },
      );
    }

    const bucket =
      process.env.R2_ORIGINALS_BUCKET;

    if (!bucket) {
      throw new Error(
        "Chýba R2_ORIGINALS_BUCKET.",
      );
    }

    const r2Client = getR2Client();

    const orderKey =
      `_orders/${orderId}.json`;

    const orderResponse =
      await r2Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: orderKey,
        }),
      );

    if (!orderResponse.Body) {
      return NextResponse.json(
        {
          error:
            "Objednávka sa nenašla.",
        },
        {
          status: 404,
        },
      );
    }

    const content =
      await orderResponse.Body
        .transformToString();

    const order = JSON.parse(
      content,
    ) as Order;

    if (
      !order.downloadTokenHash ||
      !tokensMatch(
        order.downloadTokenHash,
        token,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Odkaz na stiahnutie nie je platný.",
        },
        {
          status: 403,
        },
      );
    }

    if (!order.downloadExpiresAt) {
      return NextResponse.json(
        {
          error:
            "Odkaz na stiahnutie nemá platnosť.",
        },
        {
          status: 403,
        },
      );
    }

    if (
      new Date(order.downloadExpiresAt)
        .getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          error:
            "Platnosť odkazu na stiahnutie vypršala.",
        },
        {
          status: 410,
        },
      );
    }

    if (
      order.status !== "sent" &&
      order.status !== "downloaded"
    ) {
      return NextResponse.json(
        {
          error:
            "Originál ešte nebol odoslaný.",
        },
        {
          status: 403,
        },
      );
    }

    const objectKey =
      `${order.gallerySlug}/` +
      `${order.filename}`;

    const command =
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ResponseContentDisposition:
          `attachment; filename="${order.filename}"`,
      });

    const downloadUrl =
      await getSignedUrl(
        r2Client,
        command,
        {
          expiresIn: 5 * 60,
        },
      );

    if (
      order.status !== "downloaded"
    ) {
      const updatedOrder: Order = {
        ...order,
        status: "downloaded",
        downloadedAt:
          new Date().toISOString(),
      };

      await r2Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: orderKey,
          Body: JSON.stringify(
            updatedOrder,
            null,
            2,
          ),
          ContentType:
            "application/json; charset=utf-8",
          CacheControl: "no-store",
        }),
      );
    }

    return NextResponse.redirect(
      downloadUrl,
    );
  } catch (error) {
    console.error(
      "Chyba pri sťahovaní originálu:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Originál sa nepodarilo pripraviť na stiahnutie.",
      },
      {
        status: 500,
      },
    );
  }
}