"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// The optimization-EVENT filter (Rahul, strict, global): multi-select the events campaigns optimize for
// (e.g. Add to cart, Purchase, Lead) to scope the WHOLE dashboard to. Stored in "adbrain.events" which
// resolveCockpitScope reads server-side; a refresh re-scopes every page. Sibling of ObjectiveSwitcher.
//
// KEY DIFFERENCE from Objective: the options are NOT hardcoded. Meta returns the raw event string per ad
// (custom_event_type / optimization_goal), so the cookie value MUST equal what the store holds. We fetch
// the distinct events actually present (/api/scope/events); if none are synced yet we render a disabled
// control instead of offering an event that would empty every screen. No fabrication, no footgun.

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  for (const part of document.cookie.split("; ")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return "";
}

// Raw Meta event token -> readable label. "ADD_TO_CART" -> "Add to cart", "OFFSITE_CONVERSIONS" ->
// "Offsite conversions". Purely cosmetic; the raw token stays the filter key.
function humanize(ev: string): string {
  const s = ev.replace(/_/g, " ").toLowerCase().trim();
  return s ? s[0].toUpperCase() + s.slice(1) : ev;
}

export function EventSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<string[] | null>(null); // null = still loading
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = readCookie("adbrain.events");
    setSel(new Set(raw ? raw.split(",").filter(Boolean) : []));
    let alive = true;
    fetch("/api/scope/events")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d: { events?: string[] }) => { if (alive) setOptions(d.events ?? []); })
      .catch(() => { if (alive) setOptions([]); });
    return () => { alive = false; };
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

  function apply(next: Set<string>) {
    setSel(next);
    const val = Array.from(next).join(",");
    document.cookie = `adbrain.events=${encodeURIComponent(val)}; path=/; max-age=${val ? 60 * 60 * 24 * 30 : 0}`;
    startTransition(() => router.refresh());
  }

  function toggle(key: string) {
    const next = new Set(sel);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    apply(next);
  }

  // No events synced yet: show a disabled, honest control rather than an empty popover or a footgun.
  const hasOptions = (options?.length ?? 0) > 0;
  if (options !== null && !hasOptions) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        title="No event data yet - run a sync to filter by optimization event."
        className={FILTER_TRIGGER}
      >
        <span className={FILTER_LABEL}>Event</span> <span className="max-w-[150px] truncate">Sync to enable</span>
      </Button>
    );
  }

  const label = sel.size === 0 ? "All events" : `${sel.size} event${sel.size === 1 ? "" : "s"}`;
  const list = (options ?? []).filter((o) => humanize(o).toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={FILTER_TRIGGER}
      >
        {pending ? (
          <span className="flex items-center gap-1.5 text-[var(--accent)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
            Updating...
          </span>
        ) : (
          <>
            <span className={FILTER_LABEL}>Event</span> <span className="max-w-[150px] truncate">{label}</span>
          </>
        )}
        <span className={FILTER_LABEL}>▾</span>
      </Button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-lg">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events..."
            aria-label="Search events"
            className="mb-1.5 w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
          />
          {list.map((o) => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--ink)] transition hover:bg-[var(--surface-alt)]"
            >
              <input type="checkbox" checked={sel.has(o)} onChange={() => toggle(o)} className="h-4 w-4 accent-[var(--accent)]" />
              {humanize(o)}
            </label>
          ))}
          {sel.size > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => apply(new Set())}
              className="mt-1 w-full justify-start rounded-lg px-2.5 py-1.5 text-left text-xs text-[var(--ink-muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
            >
              Clear (show all)
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
