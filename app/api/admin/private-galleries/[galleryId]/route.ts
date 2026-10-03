import { NextRequest, NextResponse } from "next/server";
import { PrivateGalleryError } from "@/lib/private-galleries";
import { abortPrivateUpload, completePrivateUpload, privateGalleryDetail, signPrivatePart, startPrivateUpload } from "@/lib/private-uploads";

import { activatePrivateGallery, blockPrivateGallery, extendPrivateGallery, deletePrivateItem } from "@/lib/private-delivery";

import { deletePrivateGallery } from "@/lib/private-cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
type Context = { params: Promise<{ galleryId: string }> };
function failure(error: unknown) {
  if (error instanceof PrivateGalleryError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  console.error("Private gallery operation failed", error instanceof Error ? error.name : "Unknown error");
  return NextResponse.json({ error: "Operácia sa nepodarila. Skús to znova." }, { status: 500, headers });
}
export async function GET(_request: NextRequest, context: Context) {
  try {
    const { galleryId } = await context.params;
    return NextResponse.json(await privateGalleryDetail(galleryId), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      throw new PrivateGalleryError("Nepovolený pôvod požiadavky.", 403);
    }
    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new PrivateGalleryError("Požiadavka musí obsahovať JSON.", 415);
    }
    const raw = await request.text();
    if (raw.length > 8192) throw new PrivateGalleryError("Požiadavka je príliš veľká.", 413);
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed;
    } catch { throw new PrivateGalleryError("Neplatný JSON.", 400); }
    const { galleryId } = await context.params;
    if (body.action === "delete-gallery") return NextResponse.json(await deletePrivateGallery(galleryId, body.confirmation), { headers });
    if (body.action === "activate") return NextResponse.json(await activatePrivateGallery(galleryId), { headers });
    if (body.action === "block") return NextResponse.json(await blockPrivateGallery(galleryId), { headers });
    if (body.action === "extend") return NextResponse.json(await extendPrivateGallery(galleryId, body.expectedExpiresAt), { headers });
    if (body.action === "delete-item" && typeof body.itemId === "string") return NextResponse.json(await deletePrivateItem(galleryId, body.itemId), { headers });
    if (body.action === "start") {
      return NextResponse.json(await startPrivateUpload(galleryId, body.filename, body.size), { headers });
    }
    if (typeof body.itemId !== "string") throw new PrivateGalleryError("Chýba ID súboru.", 400);
    if (body.action === "part") return NextResponse.json(await signPrivatePart(galleryId, body.itemId, body.partNumber), { headers });
    if (body.action === "complete") return NextResponse.json(await completePrivateUpload(galleryId, body.itemId), { headers });
    if (body.action === "abort") return NextResponse.json(await abortPrivateUpload(galleryId, body.itemId), { headers });
    throw new PrivateGalleryError("Neplatná operácia.", 400);
  } catch (error) { return failure(error); }
}
