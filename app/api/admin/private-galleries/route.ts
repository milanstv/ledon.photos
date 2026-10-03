import { NextResponse } from "next/server";
import { createPrivateGallery, listPrivateGalleries, PrivateGalleryError } from "@/lib/private-galleries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

function failure(error: unknown) {
  if (error instanceof PrivateGalleryError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  }
  console.error("Chyba súkromných galérií:", error);
  return NextResponse.json({ error: "Galérie sa nepodarilo načítať alebo uložiť." }, { status: 500, headers });
}

export async function GET() {
  try {
    return NextResponse.json({ galleries: await listPrivateGalleries() }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Neplatný pôvod požiadavky." }, { status: 403, headers });
    }
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({ error: "Očakávame JSON." }, { status: 415, headers });
    }
    const raw = await request.text();
    if (raw.length > 8192) {
      return NextResponse.json({ error: "Požiadavka je príliš veľká." }, { status: 413, headers });
    }
    let body: { title?: unknown; customerName?: unknown };
    try {
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch {
      return NextResponse.json({ error: "Neplatný JSON." }, { status: 400, headers });
    }
    const gallery = await createPrivateGallery(body.title, body.customerName);
    return NextResponse.json({ id: gallery.id }, { status: 201, headers });
  } catch (error) { return failure(error); }
}
