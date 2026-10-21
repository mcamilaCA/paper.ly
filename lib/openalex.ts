export type SortMode = "date" | "relevance" | "location";
export type AuthorRole = "any" | "last" | "first";

export interface SearchParams {
  q: string;
  n: number;
  sort: SortMode;
  countries: string[];
  role: AuthorRole;
  preprints: boolean;
}

export interface Author {
  name: string;
  position: "first" | "middle" | "last";
  countries: string[];
  institution?: string;
}

export interface Paper {
  id: string;
  title: string;
  date: string;
  url: string;
  doi?: string;
  venue?: string;
  type: string;
  citations: number;
  openAccess: boolean;
  abstract?: string;
  authors: Author[];
  countries: string[];
}

export const MAX_N = 200;
const MAX_PAGES = 6;

export function parseParams(sp: URLSearchParams): SearchParams {
  const sort = sp.get("sort");
  const role = sp.get("role");
  const n = Math.round(Number(sp.get("n")) || 25);
  return {
    q: (sp.get("q") ?? "").trim().slice(0, 200),
    n: Math.min(Math.max(n, 1), MAX_N),
    sort: sort === "relevance" || sort === "location" ? sort : "date",
    countries: (sp.get("countries") ?? "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c))
      .slice(0, 20),
    role: role === "last" || role === "first" ? role : "any",
    preprints: sp.get("preprints") === "1",
  };
}

export function toQueryString(p: SearchParams): string {
  const sp = new URLSearchParams({ q: p.q, n: String(p.n), sort: p.sort, role: p.role });
  if (p.countries.length) sp.set("countries", p.countries.join(","));
  if (p.preprints) sp.set("preprints", "1");
  return sp.toString();
}

// OpenAlex filter values can't contain these characters unescaped.
const clean = (s: string) => s.replace(/[,|:()"]/g, " ").replace(/\s+/g, " ").trim();

function buildUrl(p: SearchParams, page: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const filters = [
    `type:${p.preprints ? "article|preprint" : "article"}`,
    "is_retracted:false",
    `to_publication_date:${today}`, // OpenAlex indexes some future-dated issues
  ];
  if (p.countries.length) filters.push(`authorships.countries:${p.countries.join("|")}`);

  const url = new URL("https://api.openalex.org/works");
  if (p.sort === "relevance") {
    url.searchParams.set("search", clean(p.q));
    url.searchParams.set("sort", "relevance_score:desc");
  } else {
    filters.push(`title_and_abstract.search:${clean(p.q)}`);
    url.searchParams.set("sort", "publication_date:desc");
  }
  url.searchParams.set("filter", filters.join(","));
  url.searchParams.set("per_page", String(Math.min(MAX_N, p.role === "any" ? p.n : 100)));
  url.searchParams.set("page", String(page));
  url.searchParams.set(
    "select",
    "id,title,publication_date,doi,type,authorships,primary_location,cited_by_count,open_access,abstract_inverted_index",
  );
  if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
  if (process.env.OPENALEX_MAILTO) url.searchParams.set("mailto", process.env.OPENALEX_MAILTO);
  return url.toString();
}

function rebuildAbstract(idx?: Record<string, number[]> | null): string | undefined {
  if (!idx) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(idx)) for (const i of positions) words[i] = word;
  return words.join(" ");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalize(w: any): Paper {
  const authors: Author[] = (w.authorships ?? []).map((a: any) => ({
    name: a.author?.display_name ?? a.raw_author_name ?? "Unknown",
    position: a.author_position ?? "middle",
    countries: a.countries ?? [],
    institution: a.institutions?.[0]?.display_name,
  }));
  const doi: string | undefined = w.doi ?? undefined;
  return {
    id: w.id,
    title: w.title ?? "(untitled)",
    date: w.publication_date,
    url: doi ?? w.primary_location?.landing_page_url ?? w.id,
    doi,
    venue: w.primary_location?.source?.display_name ?? undefined,
    type: w.type,
    citations: w.cited_by_count ?? 0,
    openAccess: !!w.open_access?.is_oa,
    abstract: rebuildAbstract(w.abstract_inverted_index),
    authors,
    countries: [...new Set(authors.flatMap((a) => a.countries))],
  };
}

function matchesRole(p: Paper, countries: string[], role: AuthorRole): boolean {
  if (role === "any" || !countries.length) return true;
  const a = p.authors.find((x) => x.position === role);
  return !!a && a.countries.some((c) => countries.includes(c));
}

const regionName = new Intl.DisplayNames(["en"], { type: "region" });
const locationKey = (p: Paper) => {
  const c = p.authors.find((a) => a.position === "last")?.countries[0] ?? p.countries[0];
  return c ? regionName.of(c) ?? c : "~";
};

export class UpstreamError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function searchPapers(p: SearchParams): Promise<{ papers: Paper[]; total: number }> {
  const out: Paper[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES && out.length < p.n; page++) {
    const res = await fetch(buildUrl(p, page), { next: { revalidate: 3600 } });
    if (!res.ok) {
      throw new UpstreamError(
        res.status,
        res.status === 429 || res.status === 403
          ? "OpenAlex rate limit reached. Set OPENALEX_API_KEY and try again."
          : `OpenAlex returned ${res.status}`,
      );
    }
    const data = await res.json();
    total = data.meta?.count ?? total;
    const batch: Paper[] = (data.results ?? []).map(normalize);
    out.push(...batch.filter((x) => matchesRole(x, p.countries, p.role)));
    if (batch.length === 0 || p.role === "any") break;
  }
  const papers = out.slice(0, p.n);
  if (p.sort === "location") {
    papers.sort(
      (a, b) => locationKey(a).localeCompare(locationKey(b)) || b.date.localeCompare(a.date),
    );
  }
  return { papers, total };
}
