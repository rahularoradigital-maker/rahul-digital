"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// First-run progress island (10x #8). Shown when the account is connected but the store hasn't produced a
// cockpit yet (reason: syncing / no_data) - the silent gap that makes a new user think the app is broken.
// It polls /api/onboarding/status and turns that dead wait into visible progress, then advances to the
// cockpit the moment data lands. Honest: it only claims what the status endpoint reports.
//
// LOOP GUARD: it calls router.refresh() at most ONCE (refreshedRef). A returning user whose store already
// has data reads "ready" immediately; without the guard, refreshing back into a still-cold cockpit would
// bounce straight back here and loop. One-shot refresh + a manual button avoids that entirely.

type Status = {
  stage: "connect" | "brand" | "syncing" | "ready";
  progress: { done: number; total: number };
  ready: boolean;
  accountName: string | null;
};

const POLL_MS = 4000;

export function FirstRunProgress() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const refreshedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const res = await fetch("/api/onboarding/status", { cache: "no-store" });
        if (!alive) return;
        if (res.ok) {
          const s = (await res.json()) as Status;
          setStatus(s);
          if (s.ready && !refreshedRef.current) {
            refreshedRef.current = true;
            router.refresh(); // one-shot: reveal the cockpit now that data has landed
            return; // stop polling; the page re-renders
          }
        }
      } catch {
        // network blip - keep the last known state and try again on the next tick
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    }
    tick();

    const clock = setInterval(() => alive && setElapsed((e) => e + 1), 1000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, [router]);

  const stage = status?.stage ?? "syncing";
  const done = status?.progress.done ?? 2;
  const total = status?.progress.total ?? 3;

  const steps = [
    { key: "connect", label: "Meta account connected" },
    { key: "brand", label: "Brand confirmed" },
    { key: "syncing", label: "Building your first insight" },
  ] as const;
  // A step is complete once we are past it in the stage order.
  const order = { connect: 0, brand: 1, syncing: 2, ready: 3 } as const;
  const here = order[stage];

  return (
    <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <h2 className="text-lg font-normal text-[var(--ink)]">
        {stage === "brand" ? "One step left" : "Getting your account ready"}
      </h2>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">
        {stage === "brand"
          ? "Confirm your brand and your first decisions will be ready."
          : "Pulling your live ad data. This usually takes under a minute - you can wait here, it updates on its own."}
      </p>

      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => {
          const complete = here > order[s.key];
          const active = here === order[s.key];
          return (
            <li key={s.key} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${
                  complete
                    ? "bg-[var(--good-bg)] text-[var(--good-ink)]"
                    : active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "bg-[var(--surface-alt)] text-[var(--ink-muted)]"
                }`}
              >
                {complete ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${complete ? "text-[var(--ink-muted)]" : "text-[var(--ink)]"}`}>
                  {s.label}
                  {active && s.key === "syncing" ? (
                    <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent align-[-1px]" aria-hidden="true" />
                  ) : null}
                </div>
                {active && s.key === "brand" ? (
                  <a
                    href="/app/market?tab=brand"
                    className="mt-2 inline-block rounded-full bg-[var(--ink)] px-5 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
                  >
                    Set up brand
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex items-center gap-3 text-[12px] text-[var(--ink-muted)]" aria-live="polite">
        <span>{done}/{total} done</span>
        {stage === "syncing" ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}</span>
            {elapsed > 45 ? (
              <button
                type="button"
                onClick={() => router.refresh()}
                className="rounded-full border border-[var(--hairline)] px-3 py-1 text-[12px] text-[var(--ink)] transition hover:bg-[var(--surface-alt)]"
              >
                Refresh now
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
