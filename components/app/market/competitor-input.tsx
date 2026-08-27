"use client";

import { useEffect, useState } from "react";
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

export function CompetitorInput() {
  const router = useRouter();
  const [brandUrl, setBrandUrl] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = load();
    setBrandUrl(s.brandUrl);
    setCompetitors(s.competitors.length ? s.competitors : [""]);
    setReady(true);
  }, []);

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
    setCompetitors((prev) => prev.map((c, idx) => (idx === i ? v : c)));
  }
  function addCompetitor() {
    setCompetitors((prev) => [...prev, ""]);
  }
  function removeCompetitor(i: number) {
    setCompetitors((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }
  function save() {
    persist({ brandUrl: brandUrl.trim(), competitors: competitors.map((c) => c.trim()).filter(Boolean) });
  }

  async function run() {
    const cleanBrand = brandUrl.trim();
    const cleanCompetitors = competitors.map((c) => c.trim()).filter(Boolean);
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

  const filledCompetitors = competitors.filter((c) => c.trim()).length;
  const canRun = brandUrl.trim().length > 0 && filledCompetitors > 0;

  if (!ready) return null;

  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-1 text-base font-semibold">Ad Library URLs</div>
      <div className="mb-5 text-[13px] text-[var(--ink-muted)]">
        The only manual step. Paste your brand&apos;s Facebook Ad Library page and the competitors you want to track.
        Everything after this runs automatically.
      </div>

      <label className="mb-1.5 block text-[13px] font-medium">Your brand Ad Library URL</label>
      <input
        value={brandUrl}
        onChange={(e) => setBrandUrl(e.target.value)}
        placeholder="https://www.facebook.com/ads/library/?view_all_page_id=..."
        className={inputCls}
      />

      <label className="mb-1.5 mt-4 block text-[13px] font-medium">Competitor Ad Library URLs</label>
      <div className="space-y-2">
        {competitors.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={c}
              onChange={(e) => setCompetitor(i, e.target.value)}
              placeholder="https://www.facebook.com/ads/library/?view_all_page_id=..."
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => removeCompetitor(i)}
              disabled={competitors.length === 1}
              aria-label="Remove competitor"
              className="shrink-0 rounded-lg border border-[var(--hairline)] px-3 py-2 text-sm text-[var(--ink-muted)] transition hover:text-[var(--ink)] disabled:opacity-40"
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
          className="rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-5 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)]"
        >
          {saved ? "Saved" : "Save URLs"}
        </button>
        <button
          type="button"
          onClick={run}
          disabled={!canRun || running}
          className="rounded-[var(--radius-pill)] bg-[var(--ink)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
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
