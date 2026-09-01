"use client";

import { useEffect, useState } from "react";
import type { FunnelMetrics } from "@/lib/metrics/funnel-metrics";
import { DAILY_KPIS, type DailyKpiKey, type DailyPoint, type WindowTotals } from "@/lib/cockpit/daily-series";
import { windowHeadline } from "@/lib/cockpit/daily-series";
import type { LevelFunnels, GroupFunnel } from "@/lib/cockpit/level-funnel";
import { KPI_CATALOG } from "@/lib/app/kpi-catalog";
import { Sparkline } from "@/components/app/analytics/sparkline";
import { Badge } from "@/components/ui/badge";
import { rupees, rupeesPrecise } from "@/lib/format";

// The funnel card with an Ad / Ad set / Campaign selector, each read the way a top-1% buyer reads it, with its
// OWN default metric set - and a metric PICKER (right side) to add/remove any computable metric. Ad is a
// single account aggregate; Ad set / Campaign are DRILL-INs (pick one entity, default top spender). Every card
// is a big number + a day-wise sparkline. Real data only - "n/a" for anything unreported, never a fake 0.

type Level = "ad" | "adset" | "campaign";
type NativeKey = "reach" | "frequency" | "budget";
type MetricKey = DailyKpiKey | NativeKey;

// Per-level DEFAULT metric sets (buyer logic). The picker overrides these and remembers per level.
const DEFAULTS: Record<Level, MetricKey[]> = {
  ad: ["thumbStop", "holdRate", "ctr", "cpc", "cpm", "lpViewRate", "atcRate", "checkoutRate"],
  adset: ["cpm", "cpc", "ctr", "cpa", "roas", "spend", "reach", "frequency", "budget"],
  campaign: ["roas", "cpa", "purchases", "revenue", "spend", "cpm", "budget"],
};

const NATIVE_LABEL: Record<NativeKey, string> = { reach: "Reach", frequency: "Frequency", budget: "Budget" };
const KPI_META = new Map(DAILY_KPIS.map((k) => [k.key, k]));
const DAILY_LABEL = (k: DailyKpiKey) => KPI_META.get(k)?.label ?? k;
const isNative = (k: MetricKey): k is NativeKey => k === "reach" || k === "frequency" || k === "budget";

// Every metric the picker can TURN ON (i.e. we can actually compute it from Meta). Native metrics only apply
// at ad-set / campaign level. Everything else in the KPI sheet needs Shopify/finance data (listed, disabled).
function computableFor(level: Level): { key: MetricKey; label: string }[] {
  const daily = DAILY_KPIS.map((k) => ({ key: k.key as MetricKey, label: k.label }));
  if (level === "ad") return daily;
  return [...daily, ...(["reach", "frequency", "budget"] as NativeKey[]).map((k) => ({ key: k as MetricKey, label: NATIVE_LABEL[k] }))];
}
// The rest of the KPI sheet - shown disabled so the user sees the full menu and what unlocks it.
const NON_META_KPIS = (() => {
  const seen = new Set<string>();
  return KPI_CATALOG.filter((k) => !k.platform.toLowerCase().includes("meta"))
    .filter((k) => (seen.has(k.name) ? false : (seen.add(k.name), true)))
    .map((k) => ({ name: k.name, source: k.platform }));
})();

function fmtVal(v: number | null | undefined, fmt: string): string {
  if (v == null || !Number.isFinite(v)) return "n/a";
  switch (fmt) {
    case "x": return `${v.toFixed(2)}x`;
    case "inr": return rupees.format(v);
    case "inr2": return rupeesPrecise.format(v);
    case "pct": return `${v.toFixed(2)}%`;
    case "int": return new Intl.NumberFormat("en-IN").format(Math.round(v));
    default: return String(v);
  }
}
function compactNum(v: number | null | undefined): string {
  return v == null ? "n/a" : new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(v);
}

// Ad-level window totals from the day-wise series, so the Ad view can headline ANY daily metric (not just the
// 8 funnel ratios). Ad set / Campaign carry their own headline already.
function totalsFromSeries(series: DailyPoint[]): WindowTotals {
  let spendRs = 0, revenueRs = 0, impressions = 0, clicks = 0, purchases = 0;
  for (const p of series) {
    spendRs += p.spend; revenueRs += p.revenue; impressions += p.impressions; clicks += p.clicks; purchases += p.purchases;
  }
  return {
    spendRs, revenueRs, impressions, clicks, purchases,
    roas: spendRs > 0 ? revenueRs / spendRs : null,
    cpm: impressions > 0 ? (spendRs / impressions) * 1000 : null,
    ctrAll: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpcAll: clicks > 0 ? spendRs / clicks : null,
    cpa: purchases > 0 ? spendRs / purchases : null,
  };
}

// Per-level remembered metric selection (localStorage). Falls back to the buyer default; SSR-safe (loads after
// mount so it never mismatches hydration).
function useMetricSelection(level: Level): [MetricKey[], (k: MetricKey) => void, () => void] {
  const [sel, setSel] = useState<MetricKey[]>(DEFAULTS[level]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`funnel:metrics:${level}`);
      if (raw) {
        const parsed = JSON.parse(raw) as MetricKey[];
        if (Array.isArray(parsed) && parsed.length) setSel(parsed);
        else setSel(DEFAULTS[level]);
      } else setSel(DEFAULTS[level]);
    } catch {
      setSel(DEFAULTS[level]);
    }
  }, [level]);
  const persist = (next: MetricKey[]) => {
    setSel(next);
    try {
      localStorage.setItem(`funnel:metrics:${level}`, JSON.stringify(next));
    } catch {
      /* storage blocked - selection still applies for this view */
    }
  };
  const toggle = (k: MetricKey) => persist(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]);
  const reset = () => persist(DEFAULTS[level]);
  return [sel, toggle, reset];
}

function MetricCard({ label, hint, value, values }: { label: string; hint?: string; value: string; values?: (number | null)[] }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">{hint}</div>}
      {values && values.some((v) => v != null && Number.isFinite(v)) && <div className="mt-2"><Sparkline values={values} height={24} /></div>}
    </div>
  );
}

// One metric -> its card, resolving daily (headline + sparkline) vs native (window number, no series).
function renderCard(key: MetricKey, headline: Record<DailyKpiKey, number | null>, series: DailyPoint[], native: GroupFunnel["native"]) {
  if (isNative(key)) {
    if (key === "budget") return native?.budgetRs != null ? <MetricCard key={key} label="Budget" hint={native.budgetType === "daily" ? "per day" : native.budgetType === "lifetime" ? "lifetime" : undefined} value={rupees.format(native.budgetRs)} /> : <MetricCard key={key} label="Budget" value="n/a" />;
    if (key === "reach") return <MetricCard key={key} label="Reach" hint="unique people" value={compactNum(native?.reach)} />;
    return <MetricCard key={key} label="Frequency" hint="impressions per person" value={native?.frequency != null ? native.frequency.toFixed(2) : "n/a"} />;
  }
  const m = KPI_META.get(key);
  return <MetricCard key={key} label={m?.label ?? key} value={fmtVal(headline[key], m?.fmt ?? "int")} values={series.map((p) => p[key])} />;
}

function Pill({ level, active, onClick, children }: { level: Level; active: boolean; onClick: (l: Level) => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => onClick(level)} className={active ? "rounded-full bg-[var(--ink)] px-3 py-1 text-[12px] font-medium text-white" : "rounded-full px-3 py-1 text-[12px] text-[var(--ink-muted)] transition hover:text-[var(--ink)]"}>
      {children}
    </button>
  );
}

function MetricPicker({ level, selected, toggle, reset }: { level: Level; selected: MetricKey[]; toggle: (k: MetricKey) => void; reset: () => void }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="mb-4 rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-semibold text-[var(--ink)]">Metrics shown</div>
        <button type="button" onClick={reset} className="text-[11px] text-[var(--accent)] hover:underline">Reset to default</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {computableFor(level).map(({ key, label }) => {
          const on = selected.includes(key);
          return (
            <button key={key} type="button" onClick={() => toggle(key)} className={on ? "rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]" : "rounded-full border border-[var(--hairline)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"}>
              {on ? "✓ " : "+ "}{label}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-2 text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]">
        {showAll ? "Hide" : "Show"} the rest of the KPI sheet ({NON_META_KPIS.length} need Shopify / finance data)
      </button>
      {showAll && (
        <div className="mt-2 max-h-[160px] overflow-y-auto rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2">
          <div className="flex flex-wrap gap-1.5">
            {NON_META_KPIS.map((k) => (
              <span key={k.name} className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)] opacity-70" title={`Needs ${k.source}`}>{k.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EntityDrilldown({ level, groups, selected }: { level: "adset" | "campaign"; groups: GroupFunnel[]; selected: MetricKey[] }) {
  const [entityId, setEntityId] = useState<string>(groups[0]?.id ?? "");
  const g = groups.find((x) => x.id === entityId) ?? groups[0];
  if (!g) return <div className="py-6 text-center text-sm text-[var(--ink-muted)]">No {level === "adset" ? "ad set" : "campaign"} breakdown for this window.</div>;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={g.id} onChange={(e) => setEntityId(e.target.value)} className="max-w-full truncate rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)]">
          {groups.map((x) => (<option key={x.id} value={x.id}>{x.name} · {rupees.format(x.spendRs)}</option>))}
        </select>
        {!g.delivering && <Badge variant="muted" className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-muted)]" title="No spend in the recent window - paused or ended">not delivering</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {selected.map((k) => renderCard(k, g.headline, g.series, g.native))}
      </div>
    </>
  );
}

export function FunnelCardBody({ funnel, dailySeries, funnelLevels }: { funnel: FunnelMetrics; dailySeries: DailyPoint[]; funnelLevels?: LevelFunnels }) {
  const [level, setLevel] = useState<Level>("ad");
  const [selected, toggle, reset] = useMetricSelection(level);
  const hasLevels = Boolean(funnelLevels && (funnelLevels.adset.length > 0 || funnelLevels.campaign.length > 0));

  // Ad view headline for any daily metric, from the account day-wise series + funnel ratios.
  const adHeadline = windowHeadline(totalsFromSeries(dailySeries), funnel);

  return (
    <>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-base font-normal">Funnel metrics</div>
        {hasLevels ? (
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--bg)] p-0.5">
            <Pill level="ad" active={level === "ad"} onClick={setLevel}>Ad</Pill>
            <Pill level="adset" active={level === "adset"} onClick={setLevel}>Ad set</Pill>
            <Pill level="campaign" active={level === "campaign"} onClick={setLevel}>Campaign</Pill>
          </div>
        ) : (
          <span className="shrink-0 rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">Ad-level, this window</span>
        )}
      </div>
      <div className="mb-3 text-[13px] text-[var(--ink-muted)]">
        {level === "ad" ? "Creative + funnel for every ad, this window." : level === "adset" ? "Pick an ad set - delivery, efficiency, and native reach / frequency / budget." : "Pick a campaign - its objective outcome (ROAS, cost per result, revenue)."}
      </div>

      <MetricPicker level={level} selected={selected} toggle={toggle} reset={reset} />

      {level === "ad" ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {selected.filter((k) => !isNative(k)).map((k) => renderCard(k, adHeadline, dailySeries, undefined))}
        </div>
      ) : (
        <EntityDrilldown level={level} groups={level === "adset" ? funnelLevels?.adset ?? [] : funnelLevels?.campaign ?? []} selected={selected} />
      )}
    </>
  );
}
