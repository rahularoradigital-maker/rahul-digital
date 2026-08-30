"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";

// Date-window selector: 7 / 14 / 30 / 60 / 90 days + a custom range. Stored in the "adbrain.window" cookie
// ("<days>" or "custom:YYYY-MM-DD_YYYY-MM-DD") which resolveCockpitScope reads server-side; a refresh
// re-scopes the DISPLAY (headline totals, KPIs, funnel, trend chart) to that range. Fatigue/trend/scaling
// stay on the fixed 90-day baseline regardless (enforced in the store), so switching is instant + no re-pull.
const PRESETS = [7, 14, 30, 60, 90] as const;

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  for (const part of document.cookie.split("; ")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return "";
}

export function WindowSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("90"); // "7".."90" or "custom:since_until"
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Validate the cookie: only a known preset or a well-formed custom range is trusted. Anything else
    // (a stale cookie from an older format like "days:14") is treated as the 90-day default AND cleared,
    // so the chip never shows a value the server ignores.
    const raw = readCookie("adbrain.window") || "";
    if (raw.startsWith("custom:")) {
      const [s, u] = raw.slice(7).split("_");
      if (/^\d{4}-\d{2}-\d{2}$/.test(s ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(u ?? "")) {
        setValue(raw);
        setFrom(s);
        setTo(u);
        return;
      }
    } else if ((PRESETS as readonly number[]).includes(Number(raw))) {
      setValue(raw);
      return;
    }
    setValue("90");
    if (raw) document.cookie = "adbrain.window=; path=/; max-age=0"; // clear a stale/invalid value
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function apply(next: string) {
    setValue(next);
    setOpen(false);
    // 90 is the default; clear the cookie for it so users keep the default key shape. Others persist 30 days.
    const maxAge = next === "90" ? 0 : 60 * 60 * 24 * 30;
    document.cookie = `adbrain.window=${encodeURIComponent(next)}; path=/; max-age=${maxAge}`;
    startTransition(() => router.refresh());
  }

  function applyCustom() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return;
    apply(`custom:${from}_${to}`);
  }

  const label = value.startsWith("custom:") ? `${from} → ${to}` : `Last ${value} days`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} className={FILTER_TRIGGER}>
        {pending ? (
          <span className="flex items-center gap-1.5 text-[var(--accent)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
            Updating...
          </span>
        ) : (
          <>
            <span className={FILTER_LABEL}>Window</span> <span className="max-w-[170px] truncate">{label}</span>
          </>
        )}
        <span className={FILTER_LABEL}>▾</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-lg">
          {PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => apply(String(d))}
              className={`w-full rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${value === String(d) ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
            >
              Last {d} days
            </button>
          ))}
          <div className="mt-1 border-t border-[var(--surface-alt)] px-1 pt-2">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">Custom range</div>
            <div className="flex items-center gap-1.5">
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-2 py-1.5 text-[12px] outline-none focus:border-[var(--accent)]" />
              <span className="text-[var(--ink-muted)]">→</span>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-2 py-1.5 text-[12px] outline-none focus:border-[var(--accent)]" />
            </div>
            <button
              type="button"
              onClick={applyCustom}
              disabled={!from || !to || from > to}
              className="mt-1.5 w-full rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-[12px] font-medium text-white transition disabled:opacity-40"
            >
              Apply range
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
