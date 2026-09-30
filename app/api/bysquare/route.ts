import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RequestBody = {
  orderId?: unknown;
};

type Order = {
  id: string;
  paymentMethod?: string;
  price: number;
  variableSymbol?: string;

  bankTransfer?: {
    recipient?: string;
    bank?: string;
    iban?: string;
    qrImage?: string;
  };

  [key: string]: unknown;
};

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

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
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.BYSQUARE_API_KEY;
    const bucket = process.env.R2_ORIGINALS_BUCKET;

    if (!apiKey) {
      throw new Error("Chýba BYSQUARE_API_KEY.");
    }

    if (!bucket) {
      throw new Error("Chýba R2_ORIGINALS_BUCKET.");
    }

    const body =
      (await request.json()) as RequestBody;

    const orderId =
      typeof body.orderId === "string"
        ? body.orderId.trim()
        : "";

    if (!orderId) {
      return NextResponse.json(
        {
          error: "Chýba ID objednávky.",
        },
        {
          status: 400,
        },
      );
    }

    const r2Client = getR2Client();

    const orderKey =
      `_orders/${orderId}.json`;

    let order: Order;

    try {
      const response = await r2Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: orderKey,
        }),
      );

      if (!response.Body) {
        throw new Error(
          "Objednávka nemá obsah.",
        );
      }

      const content =
        await response.Body.transformToString();

      order =
        JSON.parse(content) as Order;
    } catch (error) {
      console.error(
        "Načítanie objednávky pre PAY by square:",
        error,
      );

      return NextResponse.json(
        {
          error:
            "Objednávka nebola nájdená.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      order.paymentMethod !==
      "bank_transfer"
    ) {
      return NextResponse.json(
        {
          error:
            "Objednávka nie je bankový prevod.",
        },
        {
          status: 400,
        },
      );
    }

    const amount = Number(order.price);

    const variableSymbol =
      typeof order.variableSymbol ===
      "string"
        ? order.variableSymbol.trim()
        : "";

    const recipient =
      typeof order.bankTransfer
        ?.recipient === "string"
        ? order.bankTransfer.recipient.trim()
        : "";

    const iban =
      typeof order.bankTransfer?.iban ===
      "string"
        ? order.bankTransfer.iban.replace(
            /\s+/g,
            "",
          )
        : "";

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !recipient ||
      !iban ||
      !/^\d{1,10}$/.test(
        variableSymbol,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Objednávka nemá platné údaje pre QR platbu.",
        },
        {
          status: 400,
        },
      );
    }

    const savedQr =
      order.bankTransfer?.qrImage;

    if (
      typeof savedQr === "string" &&
      savedQr
    ) {
      return NextResponse.json({
        image: savedQr,
        cached: true,
      });
    }

    const response = await fetch(
      "https://api.bysquare.com/generate/pay?formats=pay",
      {
        method: "POST",

        headers: {
          Authorization: apiKey,
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          payments: [
            {
              amount,
              currencyCode: "EUR",

              bankAccounts: [
                {
                  iban,
                },
              ],

              beneficiaryName:
                recipient,

              paymentNote:
                "LEDON.PHOTOS",

              variableSymbol,
            },
          ],
        }),

        cache: "no-store",
      },
    );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "by square API error:",
        data,
      );

      return NextResponse.json(
        {
          error:
            "QR platbu sa nepodarilo vytvoriť.",
        },
        {
          status: 502,
        },
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      typeof data.image !== "string" ||
      !data.image
    ) {
      console.error(
        "Neplatná odpoveď by square:",
        data,
      );

      return NextResponse.json(
        {
          error:
            "Neplatná odpoveď QR služby.",
        },
        {
          status: 502,
        },
      );
    }

    const updatedOrder: Order = {
      ...order,

      bankTransfer: {
        ...order.bankTransfer,
        qrImage: data.image,
      },
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

        CacheControl:
          "no-store",
      }),
    );

    return NextResponse.json({
      image: data.image,
      cached: false,
    });
  } catch (error) {
    console.error(
      "Chyba PAY by square:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "QR platbu sa nepodarilo vytvoriť.",
      },
      {
        status: 500,
      },
    );
  }
}