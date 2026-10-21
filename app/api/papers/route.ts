import { NextRequest, NextResponse } from "next/server";
import { parseParams, searchPapers, UpstreamError } from "@/lib/openalex";

export async function GET(req: NextRequest) {
  const params = parseParams(req.nextUrl.searchParams);
  if (!params.q) return NextResponse.json({ error: "Missing topic (q)" }, { status: 400 });
  try {
    return NextResponse.json(await searchPapers(params), {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (e) {
    const status = e instanceof UpstreamError ? (e.status === 429 ? 429 : 502) : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Search failed" }, { status });
  }
}
