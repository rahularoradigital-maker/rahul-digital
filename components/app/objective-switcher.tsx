"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// The setup-gate objective filter (rulebook 5A): multi-select the campaign objectives
// to scope the whole dashboard to. Stored in the "adbrain.objectives" cookie which
// loadCockpit reads server-side, then a refresh re-scopes every page. Empty = all.
const OBJECTIVES: { key: string; label: string }[] = [
  { key: "conversion", label: "Conversion" },
  { key: "awareness", label: "Awareness" },
  { key: "traffic", label: "Traffic" },
  { key: "engagement", label: "Engagement" },
  { key: "leads", label: "Leads" },
  { key: "app_installs", label: "App installs" },
];

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  for (const part of document.cookie.split("; ")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return "";
}

export function ObjectiveSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = readCookie("adbrain.objectives");
    setSel(new Set(raw ? raw.split(",").filter(Boolean) : []));
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
    document.cookie = `adbrain.objectives=${encodeURIComponent(val)}; path=/; max-age=${val ? 60 * 60 * 24 * 30 : 0}`;
    startTransition(() => router.refresh());
  }

  function toggle(key: string) {
    const next = new Set(sel);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    apply(next);
  }

  const label = sel.size === 0 ? "All objectives" : `${sel.size} objective${sel.size === 1 ? "" : "s"}`;

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
            <span className={FILTER_LABEL}>Objective</span> <span className="max-w-[150px] truncate">{label}</span>
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
            placeholder="Search objectives..."
            aria-label="Search objectives"
            className="mb-1.5 w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
          />
          {OBJECTIVES.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())).map((o) => (
            <label
              key={o.key}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--ink)] transition hover:bg-[var(--surface-alt)]"
            >
              <input type="checkbox" checked={sel.has(o.key)} onChange={() => toggle(o.key)} className="h-4 w-4 accent-[var(--accent)]" />
              {o.label}
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
