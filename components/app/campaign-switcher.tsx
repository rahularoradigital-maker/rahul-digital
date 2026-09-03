"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilterPopover } from "./filter-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Camp = { id: string; name: string; objective?: string };

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const parts = document.cookie.split("; ");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx > -1 && p.slice(0, idx) === name) return decodeURIComponent(p.slice(idx + 1));
  }
  return "";
}

// Campaign filter for the active account, as a SEARCHABLE MULTI-SELECT dropdown (accounts can
// have 100+ campaigns). Self-fetches; stores the chosen ids as a comma-separated list in the
// "adbrain.campaign" cookie which loadCockpit reads server-side, then refreshes so every page
// re-scopes. Empty = all campaigns.
export function CampaignSwitcher() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Camp[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [objSel, setObjSel] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  // The objective filter lives in a sibling component; router.refresh() does not remount this
  // one, so re-read the objectives cookie fresh whenever the dropdown opens - that is how the
  // campaign list stays in sync with the objective the user just picked.
  function readObjectives(): Set<string> {
    const raw = readCookie("adbrain.objectives");
    return new Set(raw ? raw.split(",").filter(Boolean) : []);
  }

  useEffect(() => {
    const raw = readCookie("adbrain.campaign");
    setSel(new Set(raw ? raw.split(",").filter(Boolean) : []));
    setObjSel(readObjectives());
    // Perf (Phase-0 audit): /api/meta/campaigns is a LIVE Meta Graph call (up to 25 pages) and this fired on
    // EVERY /app page load, for a dropdown the user may never open - the single worst per-navigation cost
    // and a steady drain on Meta's rate limit. Same 5-minute sessionStorage TTL cache the brand switcher
    // already uses, so repeat navigations within the window make zero network calls.
    const CACHE_KEY = "adbrain.campaigns";
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const c = JSON.parse(cached) as { at: number; campaigns: Camp[] };
        if (Date.now() - c.at < 5 * 60 * 1000) {
          setCampaigns(c.campaigns ?? []);
          setLoaded(true);
          return;
        }
      }
    } catch {
      // ignore cache read errors
    }
    let alive = true;
    fetch("/api/meta/campaigns")
      .then((r) => r.json())
      .then((d: { campaigns?: Camp[] }) => {
        if (!alive) return;
        setCampaigns(d.campaigns ?? []);
        setLoaded(true);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), campaigns: d.campaigns ?? [] }));
        } catch {
          // ignore cache write errors
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      // Only show campaigns matching the selected objective(s); empty = all objectives.
      if (objSel.size > 0 && !(c.objective && objSel.has(c.objective))) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [campaigns, query, objSel]);

  if (!loaded || campaigns.length === 0) return null;

  function apply(next: Set<string>) {
    setSel(next);
    const val = [...next].join(",");
    document.cookie = `adbrain.campaign=${encodeURIComponent(val)}; path=/; max-age=${val ? 60 * 60 * 24 * 30 : 0}`;
    startTransition(() => router.refresh());
  }

  function toggle(id: string) {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  }

  const summary = sel.size === 0 ? "All campaigns" : sel.size === 1 ? campaigns.find((c) => sel.has(c.id))?.name ?? "1 campaign" : `${sel.size} campaigns`;

  return (
    <FilterPopover
      label="Campaign"
      summary={summary}
      dialogLabel="Filter by campaign"
      width="w-80 max-w-[85vw]"
      onOpen={() => setObjSel(readObjectives())} // sync the list to the current objective each time it opens
    >
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search campaigns..."
        aria-label="Search campaigns"
        className="mb-1.5 w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
      />
      <div className="max-h-72 overflow-y-auto">
        <Button
          type="button"
          variant="ghost"
          onClick={() => apply(new Set())}
          className={`w-full justify-start truncate rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${sel.size === 0 ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
        >
          All campaigns
        </Button>
        {filtered.map((c) => (
          <label
            key={c.id}
            title={c.name}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--ink)] transition hover:bg-[var(--surface-alt)]"
          >
            <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
            <span className="truncate">{c.name}</span>
          </label>
        ))}
        {filtered.length === 0 && <div className="px-2.5 py-2 text-[13px] text-[var(--ink-muted)]">No campaigns match.</div>}
        {sel.size > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => apply(new Set())}
            className="mt-1 w-full justify-start rounded-lg px-2.5 py-1.5 text-left text-xs text-[var(--ink-muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
          >
            Clear (show all)
          </Button>
        )}
      </div>
    </FilterPopover>
  );
}
