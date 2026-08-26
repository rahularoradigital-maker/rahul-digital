"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { titleFor } from "@/lib/app/nav";
import { WINDOWS } from "@/lib/app/windows";

// The working topbar. Every control does its job:
//  - date window  -> sets ?days= and re-scopes the whole page (rulebook setup gate)
//  - Re-scan      -> router.refresh() re-pulls live Meta data on the server
//  - Switch acct  -> re-runs Meta OAuth so the user can connect/switch account
//  - Ask          -> honest: acknowledges until the AI answer engine is wired
export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [asked, setAsked] = useState(false);

  const current = Number(params.get("days"));
  const days = (WINDOWS as readonly number[]).includes(current) ? current : 30;

  function setDays(next: number) {
    const q = new URLSearchParams(Array.from(params.entries()));
    q.set("days", String(next));
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-xl font-semibold tracking-tight">{titleFor(pathname)}</h1>
        <span className="hidden items-center gap-1.5 text-xs text-[var(--ink-muted)] sm:flex">
          <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-[var(--good-ink)]" />
          Agents live
        </span>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {/* Ask */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAsked(true);
          }}
          className="relative hidden items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-[var(--ink-muted)] lg:flex"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            name="q"
            placeholder="Ask AdBrain anything"
            aria-label="Ask AdBrain"
            onChange={() => setAsked(false)}
            className="w-40 bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
          />
          {asked ? (
            <span className="absolute left-0 top-[calc(100%+6px)] z-20 w-72 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-left text-[12px] text-[var(--ink)] shadow-lg">
              AI answers arrive with the next update. For now, your ranked plan is in the cockpit below.
            </span>
          ) : null}
        </form>

        {/* Date window (setup gate) */}
        <label className="hidden items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium md:flex">
          <span className="text-[var(--ink-muted)]">Meta ·</span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label="Date window"
            className="cursor-pointer bg-transparent font-medium text-[var(--ink)] outline-none"
          >
            {WINDOWS.map((w) => (
              <option key={w} value={w}>
                Last {w} days
              </option>
            ))}
          </select>
        </label>

        {/* Switch / connect account */}
        <a
          href="/api/connect/meta/authorize"
          className="hidden rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium text-[var(--ink)] transition hover:border-[var(--accent)] sm:inline"
        >
          Switch account
        </a>

        {/* Re-scan */}
        <button
          type="button"
          onClick={() => startTransition(() => router.refresh())}
          disabled={pending}
          className="rounded-[var(--radius-pill)] bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Scanning..." : "Re-scan signals"}
        </button>
      </div>
    </div>
  );
}
