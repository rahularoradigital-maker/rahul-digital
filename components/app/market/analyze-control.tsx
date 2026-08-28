"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Stage 7 trigger: pick how many creatives per brand to have Gemini read, then run. The API
// caps each call so it finishes inside the serverless window and reports how many remain;
// this keeps a "Continue" affordance so large runs finish across a few clicks. Honest about
// failures (a creative Gemini could not read is reported, not silently counted as analyzed).

const OPTIONS = [10, 20, 30, 200] as const;
const LABEL: Record<number, string> = { 10: "10", 20: "20", 30: "30", 200: "All" };

export function AnalyzeControl({ analyzedCount }: { analyzedCount: number }) {
  const router = useRouter();
  const [perBrand, setPerBrand] = useState<number>(20);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function run() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch("/api/competitors/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perBrand }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; analyzed?: number; failed?: number; remaining?: number };
      if (!data.ok) {
        setMsg(data.error ?? "AI analysis failed.");
        setRunning(false);
        return;
      }
      setRemaining(data.remaining ?? 0);
      setMsg(
        `Analyzed ${data.analyzed ?? 0} creative${data.analyzed === 1 ? "" : "s"}` +
          (data.failed ? `, ${data.failed} could not be read` : "") +
          ((data.remaining ?? 0) > 0 ? ` · ${data.remaining} more queued — run again to continue` : " · done"),
      );
      router.refresh();
    } catch {
      setMsg("Network error during AI analysis.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold">AI creative analysis</div>
          <div className="text-[13px] text-[var(--ink-muted)]">
            Gemini reads each creative for 42 attributes + funnel stage.
            {analyzedCount > 0 ? ` ${analyzedCount} analyzed so far.` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[var(--ink-muted)]">Per brand:</span>
          <div className="flex overflow-hidden rounded-full border border-[var(--hairline)]">
            {OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setPerBrand(o)}
                className={`px-3 py-1.5 text-[13px] font-medium transition ${
                  perBrand === o ? "bg-[var(--ink)] text-white" : "bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-alt)]"
                }`}
              >
                {LABEL[o]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {running ? "Analyzing..." : remaining && remaining > 0 ? "Continue" : "Run AI analysis"}
          </button>
        </div>
      </div>
      {msg && <p className="mt-3 text-[13px] text-[var(--ink-muted)]">{msg}</p>}
    </div>
  );
}
