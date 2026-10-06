import { deleteSlideshow, withSlideshowMutation } from "@/lib/slideshow-deletion";
import { changeSlideshowVisibility } from "@/lib/slideshow-public";
import { NextResponse } from "next/server";
import { SlideshowError } from "@/lib/slideshow-galleries";
import { abortSlideshowUpload, completeSlideshowAsset, finishSlideshowUpload,
  signSlideshowPart, slideshowAdminDetail, startSlideshowUpload } from "@/lib/slideshow-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
type Context = { params: Promise<{ galleryId: string }> };
function failure(error: unknown) {
  if (error instanceof SlideshowError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  console.error("Slideshow súbory:", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "Akciu sa nepodarilo dokončiť." }, { status: 500, headers });
}
export async function GET(_request: Request, context: Context) {
  try { return NextResponse.json(await slideshowAdminDetail((await context.params).galleryId), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Neplatný pôvod požiadavky." }, { status: 403, headers });
    if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Očakávame JSON." }, { status: 415, headers });
    const raw = await request.text();
    if (raw.length > 8192) return NextResponse.json({ error: "Požiadavka je príliš veľká." }, { status: 413, headers });
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(); }
    catch { return NextResponse.json({ error: "Neplatný JSON." }, { status: 400, headers }); }
    const { galleryId } = await context.params;
    return await withSlideshowMutation(galleryId, async () => {
    if (body.action === "delete-gallery") return NextResponse.json(await deleteSlideshow(galleryId, "gallery", undefined, body.confirmation), { headers });
    if (body.action === "delete-item") return NextResponse.json(await deleteSlideshow(galleryId, "item", body.itemId, body.confirmation), { headers });
    if (body.action === "visibility") return NextResponse.json(await changeSlideshowVisibility(galleryId, body.status), { headers });
    if (body.action === "upload-start") return NextResponse.json(await startSlideshowUpload(galleryId, body), { headers });
    if (typeof body.itemId !== "string") throw new SlideshowError("Chýba ID slideshow.");
    let result;
    switch (body.action) {
      case "upload-part": result = await signSlideshowPart(galleryId, body.itemId, body.role, body.partNumber); break;
      case "upload-complete": result = await completeSlideshowAsset(galleryId, body.itemId, body.role); break;
      case "upload-finish": result = await finishSlideshowUpload(galleryId, body.itemId); break;
      case "upload-abort": result = await abortSlideshowUpload(galleryId, body.itemId); break;
      default: throw new SlideshowError("Neplatná akcia.");
    }
    return NextResponse.json(result, { headers });
    });
  } catch (error) { return failure(error); }
}
