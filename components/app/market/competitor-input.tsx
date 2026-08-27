"use client";

import { useEffect, useState } from "react";

// Stage 1 of the competitor-intelligence pipeline: the only manual step. The user pastes
// their own brand's Facebook Ad Library URL and one or more competitor Ad Library URLs.
// Saved locally until the ScrapeCreators data layer is wired, at which point "Run" kicks
// off stages 2 to 9. Storage is guarded so a disabled/private store never crashes the page.
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
  const [brandUrl, setBrandUrl] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

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
          disabled
          title="Connect the ScrapeCreators data layer to run the pipeline"
          className="rounded-[var(--radius-pill)] bg-[var(--ink)] px-5 py-2 text-sm font-medium text-white opacity-50"
        >
          Run analysis
        </button>
        <span className="text-xs text-[var(--ink-muted)]">
          {canRun ? "Run needs the ScrapeCreators data layer connected." : "Add your brand URL and at least one competitor."}
        </span>
      </div>
    </div>
  );
}
