import { NextRequest, NextResponse } from "next/server";
import { runPrivateCleanup, validCleanupAuthorization } from "@/lib/private-cleanup";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  if (!validCleanupAuthorization(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  try {
    const result = await runPrivateCleanup();
    return NextResponse.json(result, { status: result.errors ? 503 : 200, headers });
  } catch (error) {
    console.error("Private cleanup failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Cleanup failed" }, { status: 503, headers });
  }
}
