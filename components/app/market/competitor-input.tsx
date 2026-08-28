"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Stage 1 of the competitor-intelligence pipeline: the only manual step. The user pastes
// their own brand's Facebook Ad Library URL and one or more competitor Ad Library URLs.
// "Run analysis" posts them to /api/competitors/run (stages 2-3: ScrapeCreators pull +
// normalize), then refreshes so the dashboard (stages 4-9) renders the stored data. URLs
// are also cached locally so they persist between visits. Storage is guarded so a
// disabled/private store never crashes the page.
const STORAGE_KEY = "adbrain.competitors";

type Saved = { brandUrl: string; competitors: string[] };

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Saved;
  } catch {
    // ignore
  }
  return { brandUrl: "", competitors: [""] };
}

const inputCls =
  "w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]";

type Suggestion = { pageId: string; name: string; category: string | null; imageUri: string | null; likes: number | null; verified: boolean };

const likesFmt = new Intl.NumberFormat("en-IN", { notation: "compact" });

// A page id becomes an Ad Library URL the pull route already understands.
function libraryUrl(pageId: string): string {
  return `https://www.facebook.com/ads/library/?view_all_page_id=${pageId}`;
}

export function CompetitorInput({ market = "" }: { market?: string }) {
  const router = useRouter();
  const [brandUrl, setBrandUrl] = useState("");
  // Each competitor row carries a stable id so React keys by identity, not index: removing a middle
  // row no longer reuses the wrong DOM node / moves focus. Persisted format stays string[] (only the
  // url is saved), so the id is a purely in-memory concern.
  const idRef = useRef(1);
  const nextId = () => idRef.current++;
  const [competitors, setCompetitors] = useState<{ id: number; url: string }[]>([{ id: 0, url: "" }]);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Competitor discovery: search Meta brand pages and click to add (no URL hunting).
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const s = load();
    setBrandUrl(s.brandUrl);
    setCompetitors((s.competitors.length ? s.competitors : [""]).map((url) => ({ id: nextId(), url })));
    // Seed the search with the brand's market so suggestions appear with zero typing.
    if (market && !s.brandUrl) setQuery(market);
    setReady(true);
  }, [market]);

  // Debounced search as the query changes.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/competitors/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { ok: boolean; results?: Suggestion[] };
        if (!cancelled) setSuggestions(data.ok ? data.results ?? [] : []);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  function pickAsBrand(s: Suggestion) {
    setBrandUrl(libraryUrl(s.pageId));
  }
  function addAsCompetitor(s: Suggestion) {
    const url = libraryUrl(s.pageId);
    // Match the exact page id, not a substring: `view_all_page_id=1002` must NOT be treated as
    // already containing page id `100`. The negative lookahead stops a prefix from matching.
    const re = new RegExp(`view_all_page_id=${s.pageId}(?![0-9])`);
    setCompetitors((prev) => {
      if (prev.some((c) => re.test(c.url))) return prev;
      const filled = prev.filter((c) => c.url.trim());
      return [...filled, { id: nextId(), url }];
    });
  }

  function persist(next: Saved) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch {
      // storage unavailable; values still hold for this view
    }
  }

  function setCompetitor(i: number, v: string) {
    setCompetitors((prev) => prev.map((c, idx) => (idx === i ? { ...c, url: v } : c)));
  }
  function addCompetitor() {
    setCompetitors((prev) => [...prev, { id: nextId(), url: "" }]);
  }
  function removeCompetitor(i: number) {
    setCompetitors((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }
  function save() {
    persist({ brandUrl: brandUrl.trim(), competitors: competitors.map((c) => c.url.trim()).filter(Boolean) });
  }

  async function run() {
    const cleanBrand = brandUrl.trim();
    const cleanCompetitors = competitors.map((c) => c.url.trim()).filter(Boolean);
    persist({ brandUrl: cleanBrand, competitors: cleanCompetitors });
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/competitors/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandUrl: cleanBrand, competitors: cleanCompetitors }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; errors?: string[] };
      if (!data.ok) {
        setError(data.error ?? data.errors?.join(" · ") ?? "Could not pull ads. Check the URLs and try again.");
        setRunning(false);
        return;
      }
      if (data.errors && data.errors.length > 0) setError(data.errors.join(" · "));
      // Stored: refresh so the server component renders the dashboard from the new data.
      router.refresh();
    } catch {
      setError("Network error while pulling ads. Try again.");
    } finally {
      setRunning(false);
    }
  }

  const filledCompetitors = competitors.filter((c) => c.url.trim()).length;
  const canRun = brandUrl.trim().length > 0 && filledCompetitors > 0;

  if (!ready) return null;

  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <div className="mb-1 text-base font-normal">Find brands to track</div>
      <div className="mb-3 text-[13px] text-[var(--ink-muted)]">
        Search Meta brand pages by name or category, then click to set your brand or add a competitor. No URL hunting.
      </div>

      {/* Discovery search (reduces the manual step to a click) */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={market ? `e.g. ${market}, or a category like "wireless earbuds"` : 'Search a brand or category, e.g. "wireless earbuds"'}
        className={inputCls}
        aria-label="Search brands"
      />
      {(searching || suggestions.length > 0) && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-[10px] border border-[var(--hairline)]">
          {searching && suggestions.length === 0 && (
            <div className="px-3 py-2.5 text-[13px] text-[var(--ink-muted)]">Searching Meta pages...</div>
          )}
          {suggestions.map((s) => (
            <div key={s.pageId} className="flex items-center gap-3 border-t border-[var(--surface-alt)] px-3 py-2 first:border-t-0">
              {s.imageUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imageUri} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--surface-alt)]" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 truncate text-[13px] font-medium">
                  <span className="truncate">{s.name}</span>
                  {s.verified && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--accent)" className="shrink-0" aria-label="Verified">
                      <path d="M12 2l2.4 1.8 3 .1 1 2.8 2.4 1.8-1 2.8 1 2.8-2.4 1.8-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.2 15.5l1-2.8-1-2.8 2.4-1.8 1-2.8 3-.1L12 2z" />
                      <path d="M10.6 14.6l-2.2-2.2 1-1 1.2 1.2 3-3 1 1-4 4z" fill="#fff" />
                    </svg>
                  )}
                </div>
                <div className="truncate text-[11px] text-[var(--ink-muted)]">
                  {s.category ?? "Brand page"}
                  {typeof s.likes === "number" && s.likes > 0 ? ` · ${likesFmt.format(s.likes)} likes` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => pickAsBrand(s)}
                className="shrink-0 rounded-full border border-[var(--hairline)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink)] transition hover:border-[var(--accent)]"
              >
                My brand
              </button>
              <button
                type="button"
                onClick={() => addAsCompetitor(s)}
                className="shrink-0 rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:opacity-90"
              >
                + Competitor
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mb-1 mt-6 text-[13px] font-medium text-[var(--ink-muted)]">Or paste Ad Library URLs directly</div>

      <label className="mb-1.5 mt-2 block text-[13px] font-medium">Your brand Ad Library URL</label>
      <input
        value={brandUrl}
        onChange={(e) => setBrandUrl(e.target.value)}
        placeholder="https://www.facebook.com/ads/library/?view_all_page_id=..."
        className={inputCls}
      />

      <label className="mb-1.5 mt-4 block text-[13px] font-medium">Competitor Ad Library URLs</label>
      <div className="space-y-2">
        {competitors.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <input
              value={c.url}
              onChange={(e) => setCompetitor(i, e.target.value)}
              placeholder="https://www.facebook.com/ads/library/?view_all_page_id=..."
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => removeCompetitor(i)}
              disabled={competitors.length === 1}
              aria-label="Remove competitor"
              className="shrink-0 rounded-[10px] border border-[var(--hairline)] px-3 py-2 text-sm text-[var(--ink-muted)] transition hover:text-[var(--ink)] disabled:opacity-40"
            >
              &minus;
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addCompetitor}
        className="mt-2 text-[13px] font-medium text-[var(--accent)] transition hover:underline"
      >
        + Add another competitor
      </button>

      <div className="mt-5 flex items-center gap-3 border-t border-[var(--surface-alt)] pt-4">
        <button
          type="button"
          onClick={save}
          className="rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-5 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)]"
        >
          {saved ? "Saved" : "Save URLs"}
        </button>
        <button
          type="button"
          onClick={run}
          disabled={!canRun || running}
          className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {running ? "Pulling live ads..." : "Run analysis"}
        </button>
        <span className="text-xs text-[var(--ink-muted)]">
          {running
            ? "Fetching from the Facebook Ad Library. This can take a moment."
            : canRun
              ? "Pulls every live ad for your brand and competitors."
              : "Add your brand URL and at least one competitor."}
        </span>
      </div>
      {error && <p className="mt-3 text-[13px] text-[var(--bad-ink)]">{error}</p>}
    </div>
  );
}
