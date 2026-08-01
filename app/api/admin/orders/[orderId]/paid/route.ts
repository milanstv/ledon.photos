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

    const updatedOrder: Order = {
      ...order,
      status: "paid",
      paidAt:
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

    return NextResponse.json({
      success: true,
      order: updatedOrder,
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