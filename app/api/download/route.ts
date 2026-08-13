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

type OrderItem = {
  photoId: string;
  filename: string;
  price: number;
};

type Order = {
  id: string;
  status: string;

  gallerySlug: string;
  galleryTitle: string;
  galleryDate: string;

  // Staré objednávky
  photoId?: string;
  filename?: string;

  // BETA 2.0
  items?: OrderItem[];
  count?: number;

  email: string;
  price: number;
  unitPrice?: number;
  currency: string;

  paymentMode?: "fixed" | "manual";
  expectedAmount?: number;
  receivedAmount?: number;
  paidCount?: number;
  paidPhotoIds?: string[];

  createdAt: string;
  paidAt: string | null;
  sentAt: string | null;
  downloadedAt: string | null;

  downloadTokenHash?: string | null;
  downloadExpiresAt?: string | null;

  downloadedPhotoIds?: string[];
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

function createTokenHash(
  token: string,
) {
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
    createTokenHash(
      receivedToken,
    );

  const savedBuffer =
    Buffer.from(
      savedHash,
      "hex",
    );

  const receivedBuffer =
    Buffer.from(
      receivedHash,
      "hex",
    );

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

function getOrderItems(
  order: Order,
): OrderItem[] {
  if (
    Array.isArray(order.items) &&
    order.items.length > 0
  ) {
    return order.items;
  }

  if (
    order.photoId &&
    order.filename
  ) {
    return [
      {
        photoId: order.photoId,
        filename: order.filename,
        price: order.price,
      },
    ];
  }

  return [];
}

function getPaidItems(
  order: Order,
  items: OrderItem[],
): OrderItem[] {
  if (
    Array.isArray(order.paidPhotoIds) &&
    order.paidPhotoIds.length > 0
  ) {
    const paidIds =
      new Set(
        order.paidPhotoIds,
      );

    return items.filter(
      (item) =>
        paidIds.has(
          item.photoId,
        ),
    );
  }

  if (
    typeof order.paidCount ===
      "number" &&
    order.paidCount > 0
  ) {
    return items.slice(
      0,
      order.paidCount,
    );
  }

  // Staré objednávky alebo staré pevné platby
  // bez paidPhotoIds.
  return items;
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

    const requestedPhotoId =
      requestUrl.searchParams
        .get("photoId")
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

    const r2Client =
      getR2Client();

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

    const order =
      JSON.parse(
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

    if (
      !order.downloadExpiresAt
    ) {
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
      new Date(
        order.downloadExpiresAt,
      ).getTime() <
      Date.now()
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
      order.status !==
        "downloaded"
    ) {
      return NextResponse.json(
        {
          error:
            "Originály ešte neboli odoslané.",
        },
        {
          status: 403,
        },
      );
    }

    const items =
      getOrderItems(order);

    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "Objednávka neobsahuje žiadne fotografie.",
        },
        {
          status: 400,
        },
      );
    }

    const paidItems =
      getPaidItems(
        order,
        items,
      );

    if (
      paidItems.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "V objednávke nie je žiadna zaplatená fotografia.",
        },
        {
          status: 403,
        },
      );
    }

    let selectedItem:
      | OrderItem
      | undefined;

    if (requestedPhotoId) {
      selectedItem =
        paidItems.find(
          (item) =>
            item.photoId ===
            requestedPhotoId,
        );
    } else if (
      paidItems.length === 1
    ) {
      // Spätná kompatibilita
      // so starými linkami bez photoId.
      selectedItem =
        paidItems[0];
    }

    if (!selectedItem) {
      return NextResponse.json(
        {
          error:
            requestedPhotoId
              ? "Táto fotografia nebola zaplatená alebo nie je súčasťou objednávky."
              : "Fotografia sa v objednávke nenašla.",
        },
        {
          status: 403,
        },
      );
    }

    const objectKey =
      `${order.gallerySlug}/` +
      `${selectedItem.filename}`;

    const command =
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,

        ResponseContentDisposition:
          `attachment; filename="${selectedItem.filename}"`,
      });

    const downloadUrl =
      await getSignedUrl(
        r2Client,
        command,
        {
          expiresIn:
            5 * 60,
        },
      );

    const previousDownloaded =
      Array.isArray(
        order.downloadedPhotoIds,
      )
        ? order.downloadedPhotoIds
        : [];

    const downloadedPhotoIds =
      [
        ...new Set([
          ...previousDownloaded,
          selectedItem.photoId,
        ]),
      ];

    const allPaidDownloaded =
      paidItems.every(
        (item) =>
          downloadedPhotoIds.includes(
            item.photoId,
          ),
      );

    const updatedOrder: Order = {
      ...order,

      downloadedPhotoIds,

      status:
        allPaidDownloaded
          ? "downloaded"
          : "sent",

      downloadedAt:
        allPaidDownloaded
          ? new Date().toISOString()
          : order.downloadedAt,
    };

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: orderKey,

        Body:
          JSON.stringify(
            updatedOrder,
            null,
            2,
          ),

        ContentType:
          "application/json; charset=utf-8",

        CacheControl:
          "no-store",
      }),
    );

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