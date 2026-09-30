import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { notFound } from "next/navigation";

import BankTransferPage from "@/components/BankTransferPage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Order = {
  id: string;
  paymentMethod?: string;
  price: number;
  variableSymbol?: string;

  bankTransfer?: {
    recipient?: string;
    bank?: string;
    iban?: string;
  };
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
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

async function getOrder(
  orderId: string,
): Promise<Order | null> {
  const bucket =
    process.env.R2_ORIGINALS_BUCKET;

  if (!bucket) {
    throw new Error(
      "Chýba R2_ORIGINALS_BUCKET.",
    );
  }

  const r2Client = getR2Client();

  try {
    const response =
      await r2Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: `_orders/${orderId}.json`,
        }),
      );

    if (!response.Body) {
      return null;
    }

    const content =
      await response.Body.transformToString();

    return JSON.parse(content) as Order;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      (
        error.name === "NoSuchKey" ||
        error.name === "NotFound"
      )
    ) {
      return null;
    }

    throw error;
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{
    orderId: string;
  }>;
}) {
  const { orderId } = await params;

  const order =
    await getOrder(orderId);

  if (
    !order ||
    order.paymentMethod !==
      "bank_transfer" ||
    !order.variableSymbol ||
    !order.bankTransfer?.recipient ||
    !order.bankTransfer?.bank ||
    !order.bankTransfer?.iban
  ) {
    notFound();
  }

  return (
    <BankTransferPage
      language="sk"
      orderId={order.id}
      recipient={
        order.bankTransfer.recipient
      }
      bank={order.bankTransfer.bank}
      iban={order.bankTransfer.iban}
      amount={order.price}
      variableSymbol={
        order.variableSymbol
      }
    />
  );
}