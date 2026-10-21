import { NextRequest } from "next/server";
import { parseParams, searchPapers, toQueryString } from "@/lib/openalex";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Atom feed for a search, so it can be followed in any feed reader.
export async function GET(req: NextRequest) {
  const params = parseParams(req.nextUrl.searchParams);
  if (!params.q) return new Response("Missing topic (q)", { status: 400 });
  params.sort = "date";
  try {
    const { papers } = await searchPapers(params);
    const self = `${req.nextUrl.origin}/api/feed?${toQueryString(params)}`;
    const entries = papers
      .map((p) => {
        const authors = p.authors.slice(0, 6).map((a) => a.name).join(", ");
        return `<entry><id>${esc(p.id)}</id><title>${esc(p.title)}</title><link href="${esc(p.url)}"/><updated>${p.date}T00:00:00Z</updated><summary>${esc(
          `${authors}${p.venue ? ` — ${p.venue}` : ""}`,
        )}</summary></entry>`;
      })
      .join("");
    const xml = `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>${esc(self)}</id><title>paper.ly: ${esc(params.q)}</title><link rel="self" href="${esc(self)}"/><updated>${new Date().toISOString()}</updated>${entries}</feed>`;
    return new Response(xml, {
      headers: {
        "Content-Type": "application/atom+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600",
      },
    });
  } catch {
    return new Response("Upstream error", { status: 502 });
  }
}
