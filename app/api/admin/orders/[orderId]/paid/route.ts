import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

type OrderItem = {
  itemKey?: string;
  gallerySlug?: string;
  galleryTitle?: string;
  galleryDate?: string;

  photoId: string;
  filename: string;
  price: number;
};

type NormalizedOrderItem = {
  itemKey: string;
  gallerySlug: string;
  galleryTitle: string;
  galleryDate: string;

  photoId: string;
  filename: string;
  price: number;
};

type Order = {
  id: string;
  status: string;

  gallerySlug?: string;
  galleryTitle?: string;
  galleryDate?: string;

  photoId?: string;
  filename?: string;

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
  paidItemKeys?: string[];

  createdAt: string;
  paidAt: string | null;
  sentAt: string | null;
  downloadedAt: string | null;
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

function getOrderItems(
  order: Order,
): NormalizedOrderItem[] {
  if (
    Array.isArray(order.items) &&
    order.items.length > 0
  ) {
    const normalizedItems:
      NormalizedOrderItem[] = [];

    for (const item of order.items) {
      const gallerySlug =
        item.gallerySlug ??
        order.gallerySlug ??
        "";

      const galleryTitle =
        item.galleryTitle ??
        order.galleryTitle ??
        "";

      const galleryDate =
        item.galleryDate ??
        order.galleryDate ??
        "";

      if (
        !gallerySlug ||
        !item.photoId ||
        !item.filename ||
        !Number.isFinite(
          item.price,
        ) ||
        item.price <= 0
      ) {
        continue;
      }

      normalizedItems.push({
        itemKey:
          item.itemKey ??
          `${gallerySlug}:${item.photoId}`,

        gallerySlug,
        galleryTitle,
        galleryDate,

        photoId:
          item.photoId,

        filename:
          item.filename,

        price:
          item.price,
      });
    }

    return normalizedItems;
  }

  if (
    order.photoId &&
    order.filename &&
    order.gallerySlug
  ) {
    return [
      {
        itemKey:
          `${order.gallerySlug}:${order.photoId}`,

        gallerySlug:
          order.gallerySlug,

        galleryTitle:
          order.galleryTitle ??
          "",

        galleryDate:
          order.galleryDate ??
          "",

        photoId:
          order.photoId,

        filename:
          order.filename,

        price:
          order.price,
      },
    ];
  }

  return [];
}

function calculatePaidItems(
  items: NormalizedOrderItem[],
  receivedAmount: number,
) {
  const paidItems:
    NormalizedOrderItem[] = [];

  let usedAmount = 0;

  for (const item of items) {
    const nextAmount =
      usedAmount +
      item.price;

    if (
      nextAmount >
      receivedAmount +
        0.000001
    ) {
      break;
    }

    paidItems.push(item);
    usedAmount =
      nextAmount;
  }

  return paidItems;
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { orderId } =
      await context.params;

    if (!orderId) {
      return NextResponse.json(
        {
          error:
            "Chýba číslo objednávky.",
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

    const orderKey =
      `_orders/${orderId}.json`;

    const r2Client =
      getR2Client();

    const response =
      await r2Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: orderKey,
        }),
      );

    if (!response.Body) {
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
      await response.Body.transformToString();

    const order =
      JSON.parse(content) as Order;

    if (
      order.status !==
      "waiting_payment"
    ) {
      return NextResponse.json(
        {
          error:
            "Objednávka už bola spracovaná.",
        },
        {
          status: 400,
        },
      );
    }

    const items =
      getOrderItems(order);

    if (items.length === 0) {
      return NextResponse.json(
        {
          error:
            "Objednávka neobsahuje fotografie.",
        },
        {
          status: 400,
        },
      );
    }

    let receivedAmount =
      order.price;

    if (
      order.paymentMode ===
      "manual"
    ) {
      const body =
        await request.json().catch(
          () => ({}),
        );

      const rawReceivedAmount =
        body.receivedAmount;

      receivedAmount =
        typeof rawReceivedAmount ===
        "number"
          ? rawReceivedAmount
          : Number(
              rawReceivedAmount,
            );

      if (
        !Number.isFinite(
          receivedAmount,
        ) ||
        receivedAmount <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Zadaj skutočne prijatú sumu.",
          },
          {
            status: 400,
          },
        );
      }
    }

    receivedAmount =
      Math.round(
        receivedAmount *
          100,
      ) / 100;

    const paidItems =
      order.paymentMode ===
      "fixed"
        ? items
        : calculatePaidItems(
            items,
            receivedAmount,
          );

    const paidCount =
      paidItems.length;

    if (paidCount === 0) {
      return NextResponse.json(
        {
          error:
            "Prijatá suma nestačí ani na jednu fotografiu.",
        },
        {
          status: 400,
        },
      );
    }

    const paidItemKeys =
      paidItems.map(
        (item) =>
          item.itemKey,
      );

    const paidPhotoIds =
      paidItems.map(
        (item) =>
          item.photoId,
      );

    const updatedOrder: Order = {
      ...order,

      status: "paid",

      receivedAmount,

      paidCount,

      paidItemKeys,

      // Ponechávame aj staré pole kvôli kompatibilite.
      paidPhotoIds,

      paidAt:
        new Date().toISOString(),
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

    return NextResponse.json({
      success: true,

      order:
        updatedOrder,

      expectedAmount:
        order.expectedAmount ??
        order.price,

      receivedAmount,

      paidCount,

      unpaidCount:
        items.length -
        paidCount,
    });
  } catch (error) {
    console.error(
      "Chyba pri potvrdení platby:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Platbu sa nepodarilo potvrdiť.",
      },
      {
        status: 500,
      },
    );
  }
}