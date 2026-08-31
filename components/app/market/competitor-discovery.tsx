"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Stage 2 UI: from the confirmed brand profile, find candidate competitors (Ad Library search), let
// the user review/pick (heuristic - name search is not perfect), then pull the selected ones' ads.

type Candidate = { pageId: string; name: string; category: string | null; likes: number | null; verified: boolean };
type Tracked = { name: string; adCount: number };

export function CompetitorDiscovery() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "searching" | "review" | "tracking" | "done">("idle");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tracked, setTracked] = useState<Tracked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);

  async function find() {
    setPhase("searching");
    setError(null);
    try {
      const res = await fetch("/api/brand/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = (await res.json()) as { ok?: boolean; candidates?: Candidate[]; error?: string; suggested?: string[]; lookupError?: string };
      if (!res.ok || !d.ok) {
        setError(d.error ?? "Discovery failed. Please try again.");
        setPhase("idle");
        return;
      }
      const cands = d.candidates ?? [];
      setCandidates(cands);
      setSuggested(d.suggested ?? []);
      setLookupError(d.lookupError ?? null);
      setSelected(new Set(cands.slice(0, 6).map((c) => c.pageId))); // default-select the top few
      setPhase("review");
    } catch {
      setError("Network error. Please try again.");
      setPhase("idle");
    }
  }

  function toggle(pageId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  async function track() {
    const picks = candidates.filter((c) => selected.has(c.pageId)).map((c) => ({ pageId: c.pageId, name: c.name }));
    if (picks.length === 0) return;
    setPhase("tracking");
    setError(null);
    try {
      const res = await fetch("/api/brand/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ track: picks }) });
      const d = (await res.json()) as { ok?: boolean; tracked?: Tracked[]; error?: string };
      if (!res.ok || !d.ok) {
        setError(d.error ?? "Could not pull the competitors. Please try again.");
        setPhase("review");
        return;
      }
      setTracked(d.tracked ?? []);
      setPhase("done");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setPhase("review");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
      <div className="mb-1 text-base font-normal">Find competitors automatically</div>
      <p className="mb-4 max-w-2xl text-[13px] text-[var(--ink-muted)]">
        Searches Meta&apos;s Ad Library for the brands actually running ads for your category and products, then you pick the
        real competitors to track - their live ads flow into the Competitors and Competitor Voice tabs. Review before tracking.
      </p>

      {error && <p className="mb-3 text-[13px] text-[var(--bad-ink)]">{error}</p>}

      {phase === "idle" && (
        <button type="button" onClick={find} className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90">
          Find competitors
        </button>
      )}
      {phase === "searching" && <p className="text-[13px] text-[var(--ink-muted)]">Searching the Ad Library from your brand profile...</p>}

      {(phase === "review" || phase === "tracking") && (
        <div>
          {candidates.length === 0 ? (
            lookupError ? (
              <div className="space-y-2">
                <p className="text-[13px] text-[var(--bad-ink)]">{lookupError}</p>
                {suggested.length > 0 && (
                  <p className="text-[13px] text-[var(--ink-muted)]">
                    Competitors identified from your brand: <span className="text-[var(--ink)]">{suggested.join(", ")}</span>. Once the data provider is topped up, tracking will pull their ads.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--ink-muted)]">No candidates found. Try adding more specific sub-categories to the profile and re-confirm.</p>
            )
          ) : (
            <>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                {candidates.length} found - tick the ones to track
              </div>
              <div className="divide-y divide-[var(--surface-alt)]">
                {candidates.map((c) => (
                  <label key={c.pageId} className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input type="checkbox" checked={selected.has(c.pageId)} onChange={() => toggle(c.pageId)} className="h-4 w-4 accent-[var(--accent)]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--ink)]">
                        <span className="truncate">{c.name}</span>
                        {c.verified && <span className="shrink-0 text-[var(--accent)]" title="Verified page">&#10004;</span>}
                      </span>
                      <span className="text-[11px] text-[var(--ink-muted)]">
                        {c.category ?? "Brand"}{c.likes != null ? ` · ${Intl.NumberFormat("en-IN", { notation: "compact" }).format(c.likes)} ads in library` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--surface-alt)] pt-4">
                <button type="button" onClick={track} disabled={phase === "tracking" || selected.size === 0} className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                  {phase === "tracking" ? "Pulling their ads..." : `Track selected (${selected.size})`}
                </button>
                <button type="button" onClick={find} disabled={phase === "tracking"} className="rounded-full border border-[var(--hairline)] px-5 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)] disabled:opacity-50">
                  Re-search
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === "done" && (
        <div>
          <p className="mb-2 text-[13px] font-semibold text-[var(--good-ink)]">
            Tracking {tracked.length} competitor{tracked.length === 1 ? "" : "s"} - their ads are in the Competitors and Competitor Voice tabs now.
          </p>
          <ul className="mb-4 space-y-1.5">
            {tracked.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-[var(--ink)]">{t.name}</span>
                <span className="tabular-nums text-[var(--ink-muted)]">{t.adCount} ad{t.adCount === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => { setPhase("idle"); setCandidates([]); setSelected(new Set()); setTracked([]); }} className="rounded-full border border-[var(--hairline)] px-5 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)]">
            Find more
          </button>
        </div>
      )}
    </div>
  );
}
