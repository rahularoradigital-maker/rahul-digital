"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { summariseDeepReads } from "@/lib/creative/deep-analysis-pure";

type Read = {
  contentHash: string;
  adId: string | null;
  adName: string | null;
  format: string | null;
  spendRs: number | null;
  sceneType: string | null;
  setting: string | null;
  palette: string | null;
  visualMood: string | null;
  contentSubject: string | null;
  motionSummary: string | null;
  analyzed: boolean;
};
type Status = { used: boolean; runs: number; freeRuns: number; maxCreatives: number; reads: Read[] };

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// Deep creative analysis (free-plan trial): reads the top-N spending creatives in depth - real video MOTION
// for videos. Shows exactly which creatives AdScale spent the read on (the top spenders), one-time on free.
export function DeepAnalysisCard({ accountId }: { accountId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/creative/deep-analysis")
      .then((r) => r.json())
      .then((s: Status) => { if (live) setStatus(s); })
      .catch(() => { if (live) setError("Could not load deep-analysis status."); });
    return () => { live = false; };
  }, []);

  async function run() {
    setRunning(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/creative/deep-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) });
      const j = await res.json();
      if (j.error) setError(j.error);
      else if (j.ok === false) { setNote(j.message ?? "Could not run."); if (Array.isArray(j.reads)) setStatus((s) => ({ used: true, runs: s?.runs ?? 1, freeRuns: s?.freeRuns ?? 1, maxCreatives: s?.maxCreatives ?? 10, reads: j.reads })); }
      else setStatus((s) => ({ used: true, runs: (s?.runs ?? 0) + 1, freeRuns: s?.freeRuns ?? 1, maxCreatives: s?.maxCreatives ?? 10, reads: j.reads ?? [] }));
    } catch {
      setError("Deep analysis failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  const max = status?.maxCreatives ?? 10;
  const reads = status?.reads ?? [];

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-base font-normal">Deep creative read (video motion)</div>
        <Badge variant="accent">Free · one-time</Badge>
      </div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
        Your normal Creative DNA reads images and video cover frames. This reads the top {max} spending creatives in
        depth - for a video it watches the actual motion (the hook, the sequence, the pace), not just the cover frame.
        On the free plan you can run this once, on your {max} highest-spending ads.
      </div>

      {!status ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading deep-analysis status">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      ) : (
        <>
          {!status.used && reads.length === 0 && (
            <Button onClick={run} disabled={running}>
              {running ? `Analysing your top ${max} spenders…` : `Deep-analyse my top ${max} spenders`}
            </Button>
          )}
          {running && (
            <div className="mt-2 text-[12px] text-[var(--ink-muted)]">Reading each video takes a few seconds - this can take up to a minute. Please keep this tab open.</div>
          )}
          {note && <div className="mt-3 rounded-[8px] border border-[var(--hairline)] bg-[var(--bg)] p-3 text-[13px] text-[var(--ink)]">{note}</div>}
          {error && <div className="mt-3 rounded-[8px] border border-[var(--bad-bg)] bg-[var(--bad-bg)] p-3 text-[13px] text-[var(--bad-ink)]">{error}</div>}

          {reads.length > 0 && (
            <div className="mt-4">
              {(() => {
                const insight = summariseDeepReads(reads);
                return insight ? (
                  <div className="mb-3 rounded-[8px] border border-[var(--hairline)] bg-[var(--bg)] p-3 text-[13px] text-[var(--ink)]">
                    <span className="font-medium">What your top spenders look like:</span> {insight.line}
                  </div>
                ) : null;
              })()}
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                Creatives analysed (your top {reads.length} by spend)
              </div>
              <div className="space-y-3">
                {reads.map((r) => (
                  <div key={r.contentHash} className="border-t border-[var(--surface-alt)] pt-3 first:border-t-0 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[14px] font-medium">{r.adName ?? r.adId ?? "Creative"}</span>
                        <Badge variant={r.format === "video" ? "default" : "secondary"}>{r.format === "video" ? "Video" : "Image"}</Badge>
                        {!r.analyzed && <Badge variant="warning">Could not read</Badge>}
                      </div>
                      {r.spendRs !== null && <span className="shrink-0 text-[12px] text-[var(--ink-muted)] tabular-nums">{rupees.format(r.spendRs)} spent</span>}
                    </div>
                    {r.analyzed && (
                      <div className="mt-1 space-y-0.5 text-[12px] text-[var(--ink-muted)]">
                        <div className="capitalize">
                          {[r.sceneType, r.setting, r.palette, r.visualMood].filter(Boolean).join(" · ") || "read complete"}
                        </div>
                        {r.contentSubject && <div className="text-[var(--ink)]">{r.contentSubject}</div>}
                        {r.format === "video" && r.motionSummary && (
                          <div className="text-[var(--ink)]"><span className="font-medium">Motion:</span> {r.motionSummary}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {status.used && (
                <div className="mt-3 text-[12px] text-[var(--ink-muted)]">You have used your one free deep analysis. These reads stay saved and reused.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
