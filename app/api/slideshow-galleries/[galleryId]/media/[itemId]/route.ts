import { NextResponse } from "next/server";
import { publicSlideshowMedia } from "@/lib/slideshow-public";
import { SlideshowError } from "@/lib/slideshow-galleries";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request, context: { params: Promise<{ galleryId: string; itemId: string }> }) {
  try {
    const { galleryId, itemId } = await context.params;
    const url = await publicSlideshowMedia(galleryId, itemId, new URL(request.url).searchParams.get("kind"));
    return new NextResponse(null, { status: 302, headers: { ...headers, Location: url } });
  } catch (error) {
    return NextResponse.json({ error: "Súbor nie je dostupný." }, { status: error instanceof SlideshowError ? error.status : 500, headers });
  }
}
