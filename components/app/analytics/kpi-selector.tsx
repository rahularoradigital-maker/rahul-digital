"use client";

// Every KPI the product tracks, with a per-KPI, per-group and global "select all".
// Selection is a Set of codes persisted client-side only (localStorage); nothing here
// invents a metric value. Live values come in as pre-formatted strings from the
// server page, keyed by KPI code, and only exist for KPIs the connected account can
// actually answer today.

import { useEffect, useMemo, useState } from "react";
import type { Kpi } from "@/lib/app/kpi-catalog";

const STORAGE_KEY = "adbrain.kpis";

// Alphabetical, matches the group values present in the catalog. Any future group
// not listed here still renders, appended after these.
const GROUP_ORDER = ["Business", "Cost", "Creative", "Delivery", "Efficiency", "Funnel", "Measurement"];

// Turn a free-text `source` field into a short "Needs X" label. Checked in priority
// order because most source strings list several systems (e.g. "Shopify / GA4").
const KNOWN_SOURCES = ["Shopify", "GA4", "Finance", "Survey", "CRM", "Triple Whale", "PageSpeed", "Geo", "Scheduler", "Google", "TikTok", "Bing", "Meta"];

function sourceLabel(source: string): string {
  for (const known of KNOWN_SOURCES) {
    if (source.includes(known)) return known;
  }
  const first = source.split(/[/(,]/)[0]?.trim();
  return first || "data source";
}

export function KpiSelector({ catalog, liveValues }: { catalog: Kpi[]; liveValues: Record<string, string> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  // Load the saved selection once on mount. Any failure (storage disabled, private
  // mode, corrupt JSON) just falls back to a sensible default instead of throwing.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const codes = JSON.parse(raw) as string[];
        setSelected(new Set(codes));
      } else {
        setSelected(new Set(catalog.filter((k) => k.metaOnly).map((k) => k.code)));
      }
    } catch {
      // Render fine with nothing selected.
    }
    setReady(true);
    // Only ever runs once, against the catalog passed in on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change, once the initial load has had a chance to run so we
  // never clobber a saved selection with the empty initial state.
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selected)));
    } catch {
      // Storage full or disabled: selection still works for this page view.
    }
  }, [selected, ready]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, Kpi[]>();
    for (const kpi of catalog) {
      const list = byGroup.get(kpi.group) ?? [];
      list.push(kpi);
      byGroup.set(kpi.group, list);
    }
    const extra = Array.from(byGroup.keys()).filter((g) => !GROUP_ORDER.includes(g));
    return [...GROUP_ORDER, ...extra].filter((g) => byGroup.has(g)).map((group) => ({ group, kpis: byGroup.get(group)! }));
  }, [catalog]);

  const allCodes = useMemo(() => catalog.map((k) => k.code), [catalog]);
  const allSelected = allCodes.length > 0 && allCodes.every((c) => selected.has(c));

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allCodes) : new Set());
  }

  function toggleMany(codes: string[], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const code of codes) {
        if (checked) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  }

  function toggleOne(code: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card text-card-foreground shadow-sm p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
          <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
          Select all
        </label>
        <span className="text-[13px] tabular-nums text-[var(--ink-muted)]">
          {selected.size} of {catalog.length} selected
        </span>
      </div>

      {groups.map(({ group, kpis }) => {
        const codes = kpis.map((k) => k.code);
        const groupAllSelected = codes.length > 0 && codes.every((c) => selected.has(c));
        const groupSelectedCount = codes.filter((c) => selected.has(c)).length;

        return (
          <div key={group} className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={groupAllSelected}
                  onChange={(e) => toggleMany(codes, e.target.checked)}
                />
                {group}
              </label>
              <span className="text-xs text-[var(--ink-muted)]">
                {groupSelectedCount} of {codes.length}
              </span>
            </div>

            <div className="divide-y divide-[var(--hairline)]">
              {kpis.map((kpi) => {
                const live = liveValues[kpi.code];
                return (
                  <label key={kpi.code} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                      checked={selected.has(kpi.code)}
                      onChange={(e) => toggleOne(kpi.code, e.target.checked)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--ink)]">{kpi.name}</span>
                        <span className="text-xs text-[var(--ink-muted)]">{kpi.code}</span>
                        <span className="text-xs text-[var(--ink-muted)]">{kpi.unit}</span>
                        {kpi.metaOnly ? (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--good-ink)]">
                            Meta
                          </span>
                        ) : (
                          <span className="rounded-full border border-[var(--hairline)] px-2 py-0.5 text-[11px] text-[var(--ink-muted)]">
                            Needs {sourceLabel(kpi.source)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--ink-muted)]">{kpi.formula}</div>
                    </div>
                    <div className="shrink-0 pl-2 text-right text-sm font-medium tabular-nums text-[var(--ink)]">
                      {live ?? <span className="text-[var(--ink-muted)]">-</span>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
