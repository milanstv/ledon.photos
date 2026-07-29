import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getGallery } from "@/data/galleries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const originalsBucket = process.env.R2_ORIGINALS_BUCKET;

    if (
      !stripeSecretKey ||
      !accountId ||
      !accessKeyId ||
      !secretAccessKey ||
      !originalsBucket
    ) {
      console.error("Chýba Stripe alebo R2 nastavenie v .env.local");

      return NextResponse.json(
        { error: "Sťahovanie nie je správne nastavené." },
        { status: 500 },
      );
    }

    const requestUrl = new URL(request.url);
    const sessionId = requestUrl.searchParams.get("session_id")?.trim();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Chýba identifikátor platby." },
        { status: 400 },
      );
    }

    const stripe = new Stripe(stripeSecretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Platba ešte nebola potvrdená." },
        { status: 403 },
      );
    }

    const gallerySlug = session.metadata?.gallerySlug;
    const photoId = session.metadata?.photoId;
    const metadataFilename = session.metadata?.filename;

    if (!gallerySlug || !photoId) {
      return NextResponse.json(
        { error: "V platbe chýbajú údaje o fotografii." },
        { status: 400 },
      );
    }

    const gallery = getGallery(gallerySlug);

    if (!gallery) {
      return NextResponse.json(
        { error: "Galéria neexistuje." },
        { status: 404 },
      );
    }

    const photo = gallery.photos.find(
      (galleryPhoto) => galleryPhoto.id === photoId,
    );

    if (!photo) {
      return NextResponse.json(
        { error: "Fotografia neexistuje." },
        { status: 404 },
      );
    }

    const filename = metadataFilename || photo.filename;
    const objectKey = `${gallery.slug}/${filename}`;

    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new GetObjectCommand({
      Bucket: originalsBucket,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    });

    const downloadUrl = await getSignedUrl(r2, command, {
      expiresIn: 15 * 60,
    });

    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error("Chyba pri sťahovaní originálu:", error);

    return NextResponse.json(
      { error: "Originál sa nepodarilo pripraviť na stiahnutie." },
      { status: 500 },
    );
  }
}
