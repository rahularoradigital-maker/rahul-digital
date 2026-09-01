"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Positioning intelligence UI: OUR ICP + content pillars vs THEIR ICP + content pillars, all from real
// data (our live ads + brand profile + website; competitors' real Ad Library copy once tracked). The
// heavy lifting is the /api/market/positioning route (grounded Gemini synthesis); this just renders it.
// Works today for the OURS half even with zero competitors - the THEIRS sections fill in once competitors
// are tracked on the Competitors tab.

// Split the model's plain-text answer into "N) HEADING" sections so each renders as a titled block. Any
// preamble before the first numbered heading is kept as an intro. No fabrication: we render exactly what
// the grounded model returned, just formatted.
function parseSections(text: string): { title: string; body: string }[] {
  const parts = text.split(/\n(?=\d\)\s)/); // split before lines like "2) COMPETITORS' ICP"
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^\d\)\s*(.+?)(?:\s*[-–:]\s*|\n)([\s\S]*)$/);
      if (!m) return { title: "", body: p };
      return { title: m[1].trim(), body: m[2].trim() };
    });
}

export function PositioningSection() {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/market/positioning")
      .then((r) => r.json())
      .then((d: { content?: string | null }) => { if (alive) setContent(d.content ?? null); })
      .catch(() => {})
      .finally(() => { if (alive) setBooting(false); });
    return () => { alive = false; };
  }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market/positioning", { method: "POST" });
      const d = (await res.json()) as { content?: string; error?: string };
      if (!res.ok || !d.content) {
        setError(d.error ?? "Could not generate right now. Please try again.");
      } else {
        setContent(d.content);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const sections = content ? parseSections(content) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">Positioning: ICP &amp; content pillars</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">
          Who your ads target and the themes you run, read from your real ads, versus your tracked competitors. Audience
          reads are inferences from the ad copy, flagged as such, never invented. Track competitors on the Competitors tab
          to fill in the &ldquo;theirs&rdquo; side.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="default"
          onClick={generate}
          disabled={loading}
          className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Reading your ads and market..." : content ? "Regenerate" : "Generate positioning"}
        </Button>
        {content && <span className="text-[13px] text-[var(--ink-muted)]">From your real ads and profile · grounded, not invented</span>}
      </div>

      {error && <p className="text-[13px] text-[var(--bad-ink)]">{error}</p>}

      {booting ? (
        <p className="text-[13px] text-[var(--ink-muted)]">Loading...</p>
      ) : !content ? (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 text-sm text-[var(--ink-muted)]">
          No positioning read yet. Hit Generate - it reads your live ads, brand profile, and website to describe your ICP
          and content pillars, and compares them to any competitors you have tracked.
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={i} className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
              {s.title && <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--accent)]">{s.title}</div>}
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--ink)]">{s.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
