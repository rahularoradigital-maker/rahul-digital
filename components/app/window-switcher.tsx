"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";
import { Button } from "@/components/ui/button";

// Date-window selector, styled + behaving like the Meta Ads Manager date picker: a preset list on the left,
// a two-month calendar range on the right, a selected-range header, and an Update button that commits.
// Writes the same "adbrain.window" cookie the server already reads ("<days>" for the day-count presets, or
// "custom:YYYY-MM-DD_YYYY-MM-DD" for a calendar range / calendar-computed preset). A refresh re-scopes the
// display to that range. Self-contained: no date library, local-time date math (never UTC-shifts a day).

const DAY = 86_400_000;
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Local YYYY-MM-DD (uses local date parts so the picked day is the day the user clicked, no timezone shift).
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fromIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  for (const part of document.cookie.split("; ")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return "";
}

// A preset resolves to a concrete range + the cookie value to store. Day-count presets store "<days>"
// (keeps the server's baseline behavior); the rest store a custom range.
type Preset = { key: string; label: string; range: (today: Date) => { start: Date; end: Date }; cookie: (today: Date) => string };
const DAYS_PRESET = (n: number): Preset => ({
  key: `d${n}`,
  label: `Last ${n} days`,
  range: (t) => ({ start: startOfDay(new Date(t.getTime() - (n - 1) * DAY)), end: startOfDay(t) }),
  cookie: () => String(n),
});
const PRESETS: Preset[] = [
  { key: "today", label: "Today", range: (t) => ({ start: startOfDay(t), end: startOfDay(t) }), cookie: (t) => `custom:${iso(t)}_${iso(t)}` },
  { key: "yesterday", label: "Yesterday", range: (t) => { const y = new Date(t.getTime() - DAY); return { start: startOfDay(y), end: startOfDay(y) }; }, cookie: (t) => { const y = iso(new Date(t.getTime() - DAY)); return `custom:${y}_${y}`; } },
  DAYS_PRESET(7),
  DAYS_PRESET(14),
  DAYS_PRESET(30),
  DAYS_PRESET(90),
  { key: "thismonth", label: "This month", range: (t) => ({ start: new Date(t.getFullYear(), t.getMonth(), 1), end: startOfDay(t) }), cookie: (t) => `custom:${iso(new Date(t.getFullYear(), t.getMonth(), 1))}_${iso(startOfDay(t))}` },
  { key: "lastmonth", label: "Last month", range: (t) => ({ start: new Date(t.getFullYear(), t.getMonth() - 1, 1), end: new Date(t.getFullYear(), t.getMonth(), 0) }), cookie: (t) => `custom:${iso(new Date(t.getFullYear(), t.getMonth() - 1, 1))}_${iso(new Date(t.getFullYear(), t.getMonth(), 0))}` },
  { key: "max", label: "Maximum", range: (t) => ({ start: new Date(t.getFullYear() - 3, t.getMonth(), 1), end: startOfDay(t) }), cookie: (t) => `custom:${iso(new Date(t.getFullYear() - 3, t.getMonth(), 1))}_${iso(startOfDay(t))}` },
];

function MonthGrid({ month, today, start, end, onPick, onHover }: { month: Date; today: Date; start: Date | null; end: Date | null; onPick: (d: Date) => void; onHover: (d: Date | null) => void }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = first.getDay(); // 0=Sun
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));

  return (
    <div className="w-[224px]">
      <div className="mb-2 text-center text-[13px] font-semibold text-[var(--ink)]">{MONTHS[month.getMonth()]} {month.getFullYear()}</div>
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((w) => <div key={w} className="text-center text-[10px] font-medium uppercase text-[var(--ink-muted)]">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const future = d.getTime() > today.getTime();
          const isStart = start && sameDay(d, start);
          const isEnd = end && sameDay(d, end);
          const inRange = start && end && d.getTime() > start.getTime() && d.getTime() < end.getTime();
          const edge = isStart || isEnd;
          return (
            <Button
              key={i}
              type="button"
              variant="ghost"
              size="icon"
              disabled={future}
              onMouseEnter={() => onHover(d)}
              onClick={() => onPick(d)}
              className={[
                "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12px] tabular-nums transition",
                future ? "cursor-not-allowed text-[var(--ink-muted)] opacity-40" : "text-[var(--ink)] hover:bg-[var(--surface-alt)]",
                inRange ? "bg-[var(--surface-alt)]" : "",
                edge ? "bg-[var(--accent)] font-semibold text-white hover:bg-[var(--accent)]" : "",
              ].join(" ")}
            >
              {d.getDate()}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function WindowSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("90"); // committed cookie value
  const [committedLabel, setCommittedLabel] = useState("Last 90 days");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Selection state (uncommitted until Update).
  const today = useMemo(() => startOfDay(new Date()), []);
  const [selStart, setSelStart] = useState<Date | null>(null);
  const [selEnd, setSelEnd] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const [activePreset, setActivePreset] = useState<string | null>(null);

  useEffect(() => {
    const raw = readCookie("adbrain.window") || "";
    if (raw.startsWith("custom:")) {
      const [s, u] = raw.slice(7).split("_");
      if (/^\d{4}-\d{2}-\d{2}$/.test(s ?? "") && /^\d{4}-\d{2}-\d{2}$/.test(u ?? "")) {
        setValue(raw);
        setCommittedLabel(`${s} → ${u}`);
        return;
      }
    } else if (raw && !Number.isNaN(Number(raw))) {
      setValue(raw);
      setCommittedLabel(`Last ${raw} days`);
      return;
    }
    setValue("90");
    setCommittedLabel("Last 90 days");
    if (raw) document.cookie = "adbrain.window=; path=/; max-age=0";
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

  // Seed the calendar from the committed value each time the picker opens.
  function openPicker() {
    let s: Date | null = null;
    let e: Date | null = null;
    if (value.startsWith("custom:")) {
      const [cs, cu] = value.slice(7).split("_");
      if (cs && cu) { s = fromIso(cs); e = fromIso(cu); }
    } else if (!Number.isNaN(Number(value))) {
      const n = Number(value);
      s = startOfDay(new Date(today.getTime() - (n - 1) * DAY));
      e = today;
    }
    setSelStart(s);
    setSelEnd(e);
    setActivePreset(null);
    setViewMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    setOpen(true);
  }

  function pickDay(d: Date) {
    setActivePreset(null);
    if (!selStart || (selStart && selEnd)) {
      setSelStart(d);
      setSelEnd(null);
    } else if (d.getTime() < selStart.getTime()) {
      setSelStart(d);
    } else {
      setSelEnd(d);
    }
  }

  function pickPreset(p: Preset) {
    const { start, end } = p.range(today);
    setSelStart(start);
    setSelEnd(end);
    setActivePreset(p.key);
    setViewMonth(new Date(end.getFullYear(), end.getMonth() - 1, 1));
  }

  function update() {
    if (!selStart || !selEnd) return;
    const preset = activePreset ? PRESETS.find((p) => p.key === activePreset) : null;
    const cookieVal = preset ? preset.cookie(today) : `custom:${iso(selStart)}_${iso(selEnd)}`;
    setValue(cookieVal);
    setCommittedLabel(cookieVal.startsWith("custom:") ? `${iso(selStart)} → ${iso(selEnd)}` : `Last ${cookieVal} days`);
    setOpen(false);
    const maxAge = cookieVal === "90" ? 0 : 60 * 60 * 24 * 30;
    document.cookie = `adbrain.window=${encodeURIComponent(cookieVal)}; path=/; max-age=${maxAge}`;
    startTransition(() => router.refresh());
  }

  // Preview end while hovering (before the second click), Meta-style.
  const effEnd = selEnd ?? (selStart && hover && hover.getTime() > selStart.getTime() ? hover : null);

  return (
    <div ref={ref} className="relative">
      <Button type="button" variant="outline" onClick={() => (open ? setOpen(false) : openPicker())} aria-haspopup="dialog" aria-expanded={open} className={FILTER_TRIGGER}>
        {pending ? (
          <span className="flex items-center gap-1.5 text-[var(--accent)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
            Updating...
          </span>
        ) : (
          <>
            <span className={FILTER_LABEL}>Window</span> <span className="max-w-[190px] truncate">{committedLabel}</span>
          </>
        )}
        <span className={FILTER_LABEL}>▾</span>
      </Button>

      {open ? (
        <div role="dialog" aria-label="Select date range" className="absolute right-0 top-[calc(100%+6px)] z-30 flex max-w-[94vw] flex-col overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--surface)] shadow-xl sm:flex-row">
          {/* presets */}
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--hairline)] p-2 sm:w-[150px] sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                type="button"
                variant="ghost"
                onClick={() => pickPreset(p)}
                className={`justify-start whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${activePreset === p.key ? "bg-[var(--surface-alt)] font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* calendar */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <Button type="button" variant="ghost" size="icon" aria-label="Previous month" onClick={() => setViewMonth((m) => addMonths(m, -1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-alt)]">‹</Button>
              <div className="text-[12px] tabular-nums text-[var(--ink-muted)]">
                {selStart ? iso(selStart) : "Start"} <span className="mx-1">→</span> {effEnd ? iso(effEnd) : "End"}
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Next month" onClick={() => setViewMonth((m) => addMonths(m, 1))} disabled={addMonths(viewMonth, 1).getTime() > new Date(today.getFullYear(), today.getMonth(), 1).getTime()} className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] disabled:opacity-30">›</Button>
            </div>
            <div className="flex gap-4" onMouseLeave={() => setHover(null)}>
              <MonthGrid month={viewMonth} today={today} start={selStart} end={effEnd} onPick={pickDay} onHover={setHover} />
              <div className="hidden sm:block">
                <MonthGrid month={addMonths(viewMonth, 1)} today={today} start={selStart} end={effEnd} onPick={pickDay} onHover={setHover} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--hairline)] pt-3">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-[13px] text-[var(--ink-muted)] hover:bg-[var(--surface-alt)]">Cancel</Button>
              <Button type="button" variant="default" size="sm" onClick={update} disabled={!selStart || !selEnd} className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-[13px] font-medium text-white transition disabled:opacity-40">Update</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
