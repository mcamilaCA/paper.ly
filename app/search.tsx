"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { COUNTRIES, countryName } from "@/lib/countries";
import { useLibrary, type Library, type Status } from "@/lib/library";
import { parseParams, toQueryString, type Paper, type SearchParams } from "@/lib/openalex";

interface Followed {
  id: string;
  query: string;
  seen: string[];
}
const STORE = "paperly:followed";
const load = (): Followed[] => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]");
  } catch {
    return [];
  }
};
const describe = (p: SearchParams) =>
  `${p.q}${p.countries.length ? ` · ${p.countries.join(", ")}` : ""}${p.role !== "any" ? ` (${p.role} author)` : ""}`;

export default function Search() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = parseParams(new URLSearchParams(sp.toString()));
  const activeKey = active.q ? toQueryString(active) : "";

  const [form, setForm] = useState(active);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [followed, setFollowed] = useState<Followed[]>([]);
  const { lib, setStatus } = useLibrary();
  const [view, setView] = useState<"search" | Status>("search");
  const [filter, setFilter] = useState<"all" | "unread" | Status>("all");

  useEffect(() => setFollowed(load()), []);
  useEffect(() => setForm(parseParams(new URLSearchParams(activeKey))), [activeKey]);

  const persist = (f: Followed[]) => {
    setFollowed(f);
    try {
      localStorage.setItem(STORE, JSON.stringify(f));
    } catch {}
  };

  useEffect(() => {
    if (!activeKey) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/papers?${activeKey}`, { signal: ctrl.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Search failed");
        return d as { papers: Paper[]; total: number };
      })
      .then(({ papers, total }) => {
        setPapers(papers);
        setTotal(total);
        const all = load();
        const f = all.find((x) => x.id === activeKey);
        if (f) {
          const seen = new Set(f.seen);
          setFresh(new Set(papers.filter((p) => !seen.has(p.id)).map((p) => p.id)));
          f.seen = [...new Set([...papers.map((p) => p.id), ...f.seen])].slice(0, 1000);
          persist(all);
        } else setFresh(new Set());
      })
      .catch((e) => e.name !== "AbortError" && setError(e.message))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [activeKey]);

  const go = useCallback(
    (p: SearchParams) => router.push(`${pathname}?${toQueryString(p)}`),
    [router, pathname],
  );
  const set = <K extends keyof SearchParams>(k: K, v: SearchParams[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const isFollowed = followed.some((f) => f.id === activeKey);
  const toggleFollow = () =>
    persist(
      isFollowed
        ? followed.filter((f) => f.id !== activeKey)
        : [...followed, { id: activeKey, query: activeKey, seen: papers.map((p) => p.id) }],
    );

  return (
    <div className="layout">
      <aside>
        <h2>Reading list</h2>
        {(["want", "read"] as const).map((st) => (
          <button
            key={st}
            className={`follow ${view === st ? "on" : ""}`}
            onClick={() => setView(view === st ? "search" : st)}
          >
            {st === "want" ? "Want to read" : "Read"}
            <span className="count">{Object.values(lib).filter((e) => e.status === st).length}</span>
          </button>
        ))}
        <h2>Following</h2>
        {followed.length === 0 && <p className="muted">Follow a search to track what&apos;s new.</p>}
        {followed.map((f) => (
          <button
            key={f.id}
            className={`follow ${f.id === activeKey ? "on" : ""}`}
            onClick={() => {
              setView("search");
              router.push(`${pathname}?${f.query}`);
            }}
          >
            {describe(parseParams(new URLSearchParams(f.query)))}
          </button>
        ))}
      </aside>

      <main>
        <header>
          <h1>
            paper<span>.ly</span>
          </h1>
          <p className="muted">The latest papers on a topic, filtered by where the researchers are.</p>
        </header>

        <form className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.q.trim()) {
              setView("search");
              go(form);
            }
          }}
        >
          <input
            className="q"
            placeholder="Topic, e.g. neuroscience, CRISPR, graph neural networks"
            value={form.q}
            onChange={(e) => set("q", e.target.value)}
            autoFocus
          />
          <div className="row">
            <label>
              Papers
              <input
                type="number"
                min={1}
                max={200}
                value={form.n}
                onChange={(e) => set("n", Number(e.target.value))}
              />
            </label>
            <label>
              Sort by
              <select value={form.sort} onChange={(e) => set("sort", e.target.value as SearchParams["sort"])}>
                <option value="date">Date (newest)</option>
                <option value="relevance">Relevance</option>
                <option value="location">Location of investigators</option>
              </select>
            </label>
            <label>
              Country
              <select
                value={form.countries[0] ?? ""}
                onChange={(e) => set("countries", e.target.value ? [e.target.value] : [])}
              >
                <option value="">Anywhere</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Investigator
              <select
                value={form.role}
                disabled={!form.countries.length}
                onChange={(e) => set("role", e.target.value as SearchParams["role"])}
              >
                <option value="any">Any author</option>
                <option value="last">Last author (PI)</option>
                <option value="first">First author</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.preprints} onChange={(e) => set("preprints", e.target.checked)} />
              Include preprints
            </label>
            <button className="primary" type="submit">
              Search
            </button>
          </div>
        </form>

        {view !== "search" ? (
          <LibraryView lib={lib} status={view} setStatus={setStatus} />
        ) : (
          <>
            {error && <p className="error">{error}</p>}
            {loading && <p className="muted">Searching…</p>}
            {activeKey && !loading && !error && (
              <>
                <div className="bar">
                  <span>
                    {papers.length} of {total.toLocaleString()} matching papers
                  </span>
                  <span>
                    <button onClick={toggleFollow}>{isFollowed ? "★ Following" : "☆ Follow"}</button>{" "}
                    <a href={`/api/feed?${activeKey}`} target="_blank" rel="noreferrer">
                      Atom feed
                    </a>
                  </span>
                </div>
                <div className="chips">
                  {(["all", "unread", "want", "read"] as const).map((f) => (
                    <button key={f} className={filter === f ? "chip on" : "chip"} onClick={() => setFilter(f)}>
                      {{ all: "All", unread: "Unread", want: "Want to read", read: "Read" }[f]}
                    </button>
                  ))}
                </div>
                <ol>
                  {papers
                    .filter((p) => {
                      const st = lib[p.id]?.status;
                      return filter === "all" || (filter === "unread" ? !st : st === filter);
                    })
                    .map((p) => (
                      <PaperItem
                        key={p.id}
                        p={p}
                        fresh={fresh.has(p.id)}
                        status={lib[p.id]?.status}
                        setStatus={setStatus}
                      />
                    ))}
                </ol>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function LibraryView({
  lib,
  status,
  setStatus,
}: {
  lib: Library;
  status: Status;
  setStatus: (p: Paper, s: Status) => void;
}) {
  const items = Object.values(lib)
    .filter((e) => e.status === status)
    .sort((a, b) => b.at - a.at);
  return (
    <>
      <div className="bar">
        <span>{status === "want" ? "Want to read" : "Read"}</span>
        <span>{items.length} papers</span>
      </div>
      {items.length === 0 && <p className="muted">Nothing here yet. Mark papers from your search results.</p>}
      <ol>
        {items.map((e) => (
          <PaperItem key={e.paper.id} p={e.paper} fresh={false} status={e.status} setStatus={setStatus} />
        ))}
      </ol>
    </>
  );
}

function PaperItem({
  p,
  fresh,
  status,
  setStatus,
}: {
  p: Paper;
  fresh: boolean;
  status?: Status;
  setStatus: (p: Paper, s: Status) => void;
}) {
  const shown = p.authors.length > 8 ? [...p.authors.slice(0, 7), p.authors[p.authors.length - 1]] : p.authors;
  return (
    <li className={status ? `paper ${status}` : "paper"}>
      <a className="title" href={p.url} target="_blank" rel="noreferrer">
        {p.title}
      </a>
      {fresh && <span className="badge">NEW</span>}
      <div className="meta">
        {p.date} · {p.venue ?? "Unknown venue"}
        {p.type === "preprint" && " · preprint"}
        {p.openAccess && " · open access"} · {p.citations} citations
      </div>
      <div className="authors">
        {shown.map((a, i) => (
          <span key={i}>
            <span className="author" tabIndex={0}>
              {a.name}
              {a.countries.length > 0 && <sup>{a.countries.join("/")}</sup>}
              <span className="tip" role="tooltip">
                {a.institutions.length ? a.institutions.map((x) => <div key={x}>{x}</div>) : "No affiliation listed"}
              </span>
            </span>
            {a.position === "last" && " (PI)"}
            {i < shown.length - 1 && ", "}
          </span>
        ))}
        {p.authors.length > shown.length && <span className="muted"> … {p.authors.length} authors</span>}
      </div>
      <div className="muted">{p.countries.map(countryName).join(" · ")}</div>
      <div className="actions">
        <button className={status === "want" ? "act on" : "act"} onClick={() => setStatus(p, "want")}>
          {status === "want" ? "✓ Want to read" : "+ Want to read"}
        </button>
        <button className={status === "read" ? "act on" : "act"} onClick={() => setStatus(p, "read")}>
          {status === "read" ? "✓ Read" : "Mark as read"}
        </button>
      </div>
      {p.abstract && (
        <details>
          <summary>Abstract</summary>
          <p>{p.abstract}</p>
        </details>
      )}
    </li>
  );
}
