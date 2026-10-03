import { NextRequest, NextResponse } from "next/server";
import { PrivateGalleryError } from "@/lib/private-galleries";
import { customerPrivateDetail, customerPrivateFile } from "@/lib/private-delivery";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive" };
export async function POST(request: NextRequest, { params }: { params: Promise<{ galleryId: string }> }) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) throw new PrivateGalleryError("Nepovolená požiadavka.", 403);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new PrivateGalleryError("Neplatná požiadavka.", 415);
    const raw = await request.text();
    if (raw.length > 4096) throw new PrivateGalleryError("Požiadavka je príliš veľká.", 413);
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed;
    } catch { throw new PrivateGalleryError("Neplatná požiadavka.", 400); }
    const { galleryId } = await params;
    if (body.action === "detail") return NextResponse.json(await customerPrivateDetail(galleryId, body.token), { headers });
    if (body.action === "preview" || body.action === "download") return NextResponse.json(await customerPrivateFile(galleryId, body.token, body.itemId, body.action === "download"), { headers });
    throw new PrivateGalleryError("Neplatná požiadavka.", 400);
  } catch (error) {
    if (error instanceof PrivateGalleryError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    console.error("Private customer operation failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Galériu sa nepodarilo načítať. Skús to neskôr." }, { status: 503, headers });
  }
}
