import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readPhotoGallery } from "@/lib/photo-galleries";
import { photoMediaKey } from "@/lib/photo-previews";
import { getOriginalsBucket, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ galleryId: string; itemId: string }> }
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  try {
    const { galleryId, itemId } = await context.params;
    const key = photoMediaKey(galleryId, itemId, "preview");
    const record = await readPhotoGallery(galleryId);

    if (
      !record ||
      record.gallery.status !== "published" ||
      record.gallery.deletionPending
    ) {
      return new NextResponse(null, { status: 404, headers });
    }

    const item = record.gallery.items.find(photo => photo.id === itemId);
    if (!item || item.status !== "ready" || item.previewKey !== key) {
      return new NextResponse(null, { status: 404, headers });
    }

    const url = await getSignedUrl(
      getR2Client(),
      new GetObjectCommand({
        Bucket: getOriginalsBucket(),
        Key: key,
      }),
      { expiresIn: 900 }
    );

    return new NextResponse(null, {
      status: 302,
      headers: { ...headers, Location: url },
    });
  } catch {
    return new NextResponse(null, { status: 404, headers });
  }
}
