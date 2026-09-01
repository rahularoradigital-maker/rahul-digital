"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// In-app token meter (pricing Phase 2). Reads /api/usage (own-user, read-only) and shows plan + used/allowance
// with a threshold-coloured bar: accent under 80%, amber at 80%+, red when out - with an Upgrade nudge once the
// user is running low. Renders nothing until data loads and silently no-ops on any error, so it is safe to mount
// on every app page.

type Usage = { planLabel: string; used: number; allowance: number; remaining: number; pct: number };

export function UsageMeter() {
  const [u, setU] = useState<Usage | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/usage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && !d.error && typeof d.allowance === "number") setU(d as Usage);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!u) return null;

  const level = u.pct >= 100 ? "over" : u.pct >= 80 ? "warn" : "ok";
  const barColor = level === "over" ? "var(--bad-ink)" : level === "warn" ? "var(--warn-ink)" : "var(--accent)";

  return (
    <div className="mt-4 rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-[var(--ink)]">{u.planLabel} plan</span>
        <span className="text-[var(--ink-muted)] tabular-nums">
          {u.used.toLocaleString("en-US")}/{u.allowance.toLocaleString("en-US")}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, u.pct)}%`, background: barColor }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
        <span>{level === "over" ? "Out of tokens this month" : `${u.remaining.toLocaleString("en-US")} tokens left`}</span>
        {level !== "ok" && (
          <Link href="/pricing" className="font-medium text-[var(--accent)] hover:underline">
            Upgrade
          </Link>
        )}
      </div>
    </div>
  );
}
