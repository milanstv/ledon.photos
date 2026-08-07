import {
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      orderId: string;
    }>;
  },
) {
  try {
    const { orderId } =
      await context.params;

    if (!orderId) {
      return NextResponse.json(
        {
          error:
            "Chýba ID objednávky.",
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

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: `_orders/${orderId}.json`,
      }),
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Chyba pri mazaní objednávky:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Objednávku sa nepodarilo vymazať.",
      },
      {
        status: 500,
      },
    );
  }
}