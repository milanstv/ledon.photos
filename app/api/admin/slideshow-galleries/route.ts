import { NextResponse } from "next/server";
import { createSlideshowGallery, listSlideshowGalleries, SlideshowError } from "@/lib/slideshow-galleries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

function failure(error: unknown) {
  if (error instanceof SlideshowError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers });
  }
  console.error("Slideshow administrácia:", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "Galérie sa nepodarilo načítať alebo uložiť." }, { status: 500, headers });
}

export async function GET() {
  try { return NextResponse.json({ galleries: await listSlideshowGalleries() }, { headers }); }
  catch (error) { return failure(error); }
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
    if (raw.length > 4096) {
      return NextResponse.json({ error: "Požiadavka je príliš veľká." }, { status: 413, headers });
    }
    let body: { title?: unknown; date?: unknown };
    try {
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch {
      return NextResponse.json({ error: "Neplatný JSON." }, { status: 400, headers });
    }
    return NextResponse.json({ gallery: await createSlideshowGallery(body.title, body.date) },
      { status: 201, headers });
  } catch (error) { return failure(error); }
}
