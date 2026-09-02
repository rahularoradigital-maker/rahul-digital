"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilterPopover } from "./filter-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// The setup-gate objective filter (rulebook 5A): multi-select the campaign objectives
// to scope the whole dashboard to. Stored in the "adbrain.objectives" cookie which
// loadCockpit reads server-side, then a refresh re-scopes every page. Empty = all.
// Open/close/keyboard/focus behaviour lives in the shared <FilterPopover> (Phase-0 audit).
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
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const raw = readCookie("adbrain.objectives");
    setSel(new Set(raw ? raw.split(",").filter(Boolean) : []));
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

  const summary = sel.size === 0 ? "All objectives" : `${sel.size} objective${sel.size === 1 ? "" : "s"}`;

  return (
    <FilterPopover label="Objective" summary={summary} pending={pending} dialogLabel="Filter by objective">
      <Input
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
    </FilterPopover>
  );
}
