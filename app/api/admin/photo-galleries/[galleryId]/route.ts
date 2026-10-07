import { NextRequest, NextResponse } from "next/server";
import { PhotoGalleryError, setPhotoGalleryCover } from "@/lib/photo-galleries";
import { completePhotoUpload, photoGalleryDetail, signPhotoPart, startPhotoUpload } from "@/lib/photo-uploads";
import { createPhotoPreviews } from "@/lib/photo-previews";
import { deletePhoto } from "@/lib/photo-deletion";
import { deletePhotoGallery } from "@/lib/photo-gallery-deletion";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
type Context = { params: Promise<{ galleryId: string }> };
function failure(e: unknown) {
  if (e instanceof PhotoGalleryError) return NextResponse.json({ error: e.message }, { status: e.status, headers });
  console.error("Photo upload failed", e instanceof Error ? e.name : "Unknown error");
  return NextResponse.json({ error: "Operácia sa nepodarila. Skús znova." }, { status: 500, headers });
}
export async function GET(_request: NextRequest, context: Context) {
  try { return NextResponse.json(await photoGalleryDetail((await context.params).galleryId), { headers }); }
  catch (e) { return failure(e); }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new PhotoGalleryError("Nepovolený pôvod požiadavky.", 403);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new PhotoGalleryError("Požiadavka musí obsahovať JSON.", 415);
    const raw = await request.text();
    if (raw.length > 4096) throw new PhotoGalleryError("Požiadavka je príliš veľká.", 413);
    let body: Record<string, unknown>;
    try { const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); body = parsed; }
    catch { throw new PhotoGalleryError("Neplatný JSON."); }
    const { galleryId } = await context.params;
    if (body.action === "start") return NextResponse.json(await startPhotoUpload(galleryId, body.itemId, body.filename, body.size), { headers });
    if (body.action === "delete-gallery") return NextResponse.json(await deletePhotoGallery(galleryId, body.title), { headers });
    if (typeof body.itemId !== "string") throw new PhotoGalleryError("Chýba ID súboru.");
    if (body.action === "delete") return NextResponse.json(await deletePhoto(galleryId, body.itemId), { headers });
    if (body.action === "cover") return NextResponse.json(await setPhotoGalleryCover(galleryId, body.itemId), { headers });
    if (body.action === "preview") return NextResponse.json(await createPhotoPreviews(galleryId, body.itemId), { headers });
    if (body.action === "part") return NextResponse.json(await signPhotoPart(galleryId, body.itemId, body.partNumber), { headers });
    if (body.action === "complete") return NextResponse.json(await completePhotoUpload(galleryId, body.itemId), { headers });
    throw new PhotoGalleryError("Neplatná operácia.");
  } catch (e) { return failure(e); }
}
