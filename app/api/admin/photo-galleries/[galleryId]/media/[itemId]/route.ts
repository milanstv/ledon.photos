import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PhotoGalleryError, requirePhotoGallery } from "@/lib/photo-galleries";
import { photoMediaKey } from "@/lib/photo-previews";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ galleryId: string; itemId: string }> }
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };

  try {
    const { galleryId, itemId } = await context.params;
    const kind = request.nextUrl.searchParams.get("kind") === "social"
      ? "social" : "preview";
    const key = photoMediaKey(galleryId, itemId, kind);
    const { gallery } = await requirePhotoGallery(galleryId);
    const item = gallery.items.find(photo => photo.id === itemId);

    if (
      !item || item.status !== "ready" ||
      (kind === "preview" ? item.previewKey : item.socialKey) !== key
    ) {
      throw new PhotoGalleryError("Náhľad ešte nie je pripravený.", 404);
    }

    const client = getR2Client();
    const Bucket = getOriginalsBucket();
    const metadata = await client.send(new HeadObjectCommand({
      Bucket, Key: key,
    }));

    if (!metadata.ContentLength || metadata.ContentLength > 10 * 1024 * 1024) {
      throw new PhotoGalleryError("Náhľad sa nepodarilo načítať.", 404);
    }

    const disposition = kind === "social"
      ? `attachment; filename="social-${item.filename.replace(/[^a-zA-Z0-9_.-]/g, "-")}"`
      : "inline";

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket,
        Key: key,
        ResponseContentType: "image/jpeg",
        ResponseCacheControl: "private, no-store",
        ResponseContentDisposition: disposition,
      }),
      { expiresIn: 300 }
    );

    return new NextResponse(null, {
      status: 302,
      headers: { ...headers, Location: url },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof PhotoGalleryError
          ? error.message : "Náhľad sa nepodarilo načítať.",
      },
      {
        status: error instanceof PhotoGalleryError ? error.status : 500,
        headers,
      }
    );
  }
}
