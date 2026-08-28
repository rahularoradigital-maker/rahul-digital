"use client";

import { useState } from "react";

// The Generate / Regenerate + display surface shared by Brand Brain and Concepts. Posts to
// /api/creative/analyze, which reads the account's REAL ads and returns a grounded Gemini analysis.
// `initial` is the server-prefilled cached result (so a reload shows it without re-paying).
export function GenerateInsight({ type, initial, emptyCta }: { type: "brand" | "concepts"; initial: string | null; emptyCta: string }) {
  const [content, setContent] = useState<string | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/creative/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) });
      const d = (await res.json()) as { content?: string; error?: string };
      if (d.content) setContent(d.content);
      else setError(d.error ?? "Could not generate.");
    } catch {
      setError("Generation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">From your real ads · grounded, not invented</span>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="shrink-0 rounded-full bg-[var(--ink)] px-4 py-1.5 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Reading your ads..." : content ? "Regenerate" : emptyCta}
        </button>
      </div>
      {error && (
        <p className="mb-3 rounded-[10px] border border-[var(--bad-ink)]/30 bg-[var(--bad-bg)] px-3.5 py-2.5 text-[13px] text-[var(--bad-ink)]">{error}</p>
      )}
      {content ? (
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ink)]">{content}</div>
      ) : !error ? (
        <p className="text-[13px] text-[var(--ink-muted)]">Click the button - AdBrain reads your live ads and their performance and writes this from your real ad names. Nothing is invented.</p>
      ) : null}
    </div>
  );
}
