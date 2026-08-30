"use client";

import { useState } from "react";
import type { FunnelMetrics } from "@/lib/metrics/funnel-metrics";
import { DAILY_KPIS, type DailyKpiKey, type DailyPoint } from "@/lib/cockpit/daily-series";
import type { LevelFunnels, GroupFunnel } from "@/lib/cockpit/level-funnel";
import { Sparkline } from "@/components/app/analytics/sparkline";
import { rupees, rupeesPrecise } from "@/lib/format";

// The funnel card with an Ad / Ad set / Campaign selector. Each level is read the way a top-1% buyer reads it,
// with its OWN metric set:
//   - Ad       -> creative diagnostics + funnel (thumb-stop, hold, CTR, LP-view, ATC, checkout)
//   - Ad set   -> audience + delivery + efficiency (CPM, CPC, CTR, CPA, ROAS, spend) + native reach/freq/budget
//   - Campaign -> objective / outcome (ROAS, CPA, purchases, revenue, spend, CPM)
// Ad is a single account aggregate. Ad set / Campaign are DRILL-INs: pick one entity (default top spender) and
// see its metric cards + sparklines, exactly like the Ad view. Real data only - "n/a" for anything not
// reported, never a fabricated 0. A metric picker (add/remove any KPI) is the next step.

type Level = "ad" | "adset" | "campaign";

// The metrics each level shows by default. Keys are DailyPoint keys (so they carry a headline + a sparkline).
const AD_METRICS: DailyKpiKey[] = ["thumbStop", "holdRate", "ctr", "cpc", "cpm", "lpViewRate", "atcRate", "checkoutRate"];
const ADSET_METRICS: DailyKpiKey[] = ["cpm", "cpc", "ctr", "cpa", "roas", "spend"];
const CAMPAIGN_METRICS: DailyKpiKey[] = ["roas", "cpa", "purchases", "revenue", "spend", "cpm"];

const KPI_META = new Map(DAILY_KPIS.map((k) => [k.key, k]));

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

// The 8 account-level funnel ratios for the Ad view (their headline comes from FunnelMetrics, not a series).
const AD_STATS: { label: string; hint: string; kpi: DailyKpiKey; get: (f: FunnelMetrics) => number | null }[] = [
  { label: "Thumb-stop", hint: "3s video views / impressions", kpi: "thumbStop", get: (f) => f.thumbStopRate },
  { label: "Hold rate", hint: "thruplays / 3s views", kpi: "holdRate", get: (f) => f.holdRate },
  { label: "CTR", hint: "clicks / impressions", kpi: "ctr", get: (f) => f.ctr },
  { label: "CPM", hint: "cost / 1000 impressions", kpi: "cpm", get: (f) => f.cpm },
  { label: "CPC", hint: "cost / click", kpi: "cpc", get: (f) => f.cpc },
  { label: "LP view rate", hint: "landing-page views / outbound clicks", kpi: "lpViewRate", get: (f) => f.lpViewRate },
  { label: "Add-to-cart", hint: "ATC / landing-page views", kpi: "atcRate", get: (f) => f.atcRate },
  { label: "Checkout", hint: "initiate checkout / ATC", kpi: "checkoutRate", get: (f) => f.checkoutRate },
];

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

function Pill({ level, active, onClick, children }: { level: Level; active: boolean; onClick: (l: Level) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onClick(level)}
      className={active ? "rounded-full bg-[var(--ink)] px-3 py-1 text-[12px] font-medium text-white" : "rounded-full px-3 py-1 text-[12px] text-[var(--ink-muted)] transition hover:text-[var(--ink)]"}
    >
      {children}
    </button>
  );
}

// The per-entity drill-in: an entity picker + the metric card grid for the selected ad set / campaign.
function EntityDrilldown({ level, groups }: { level: "adset" | "campaign"; groups: GroupFunnel[] }) {
  const [entityId, setEntityId] = useState<string>(groups[0]?.id ?? "");
  const selected = groups.find((g) => g.id === entityId) ?? groups[0];
  if (!selected) return <div className="py-6 text-center text-sm text-[var(--ink-muted)]">No {level === "adset" ? "ad set" : "campaign"} breakdown for this window.</div>;
  const metricKeys = level === "adset" ? ADSET_METRICS : CAMPAIGN_METRICS;
  const n = selected.native;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={selected.id}
          onChange={(e) => setEntityId(e.target.value)}
          className="max-w-full truncate rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--ink)]"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name} · {rupees.format(g.spendRs)}</option>
          ))}
        </select>
        {!selected.delivering && (
          <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-muted)]" title="No spend in the recent window - paused or ended">not delivering</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {metricKeys.map((k) => {
          const m = KPI_META.get(k);
          return <MetricCard key={k} label={m?.label ?? k} value={fmtVal(selected.headline[k], m?.fmt ?? "int")} values={selected.series.map((p: DailyPoint) => p[k])} />;
        })}
        {/* Native level-only metrics (from Meta at this level) - a window number, no daily sparkline. */}
        {n?.budgetRs != null && <MetricCard label="Budget" hint={n.budgetType === "daily" ? "per day" : n.budgetType === "lifetime" ? "lifetime" : undefined} value={rupees.format(n.budgetRs)} />}
        {n?.reach != null && <MetricCard label="Reach" hint="unique people (de-duplicated)" value={compactNum(n.reach)} />}
        {n?.frequency != null && <MetricCard label="Frequency" hint="impressions per person" value={n.frequency.toFixed(2)} />}
      </div>
    </>
  );
}

export function FunnelCardBody({ funnel, dailySeries, funnelLevels }: { funnel: FunnelMetrics; dailySeries: DailyPoint[]; funnelLevels?: LevelFunnels }) {
  const [level, setLevel] = useState<Level>("ad");
  const hasLevels = Boolean(funnelLevels && (funnelLevels.adset.length > 0 || funnelLevels.campaign.length > 0));

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
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
        {level === "ad"
          ? 'Creative + funnel ratios for every ad, this window. "n/a" means the account did not report that step.'
          : level === "adset"
            ? "Pick an ad set to read its delivery + efficiency, the way a buyer does. Reach / frequency / budget are native to this level."
            : "Pick a campaign to read its objective outcome - ROAS, cost per result, and revenue."}
      </div>

      {level === "ad" ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {AD_STATS.map((s) => (
            <MetricCard key={s.label} label={s.label} hint={s.hint} value={fmtVal(s.get(funnel), KPI_META.get(s.kpi)?.fmt ?? "pct")} values={dailySeries.length > 0 ? dailySeries.map((p) => p[s.kpi]) : undefined} />
          ))}
        </div>
      ) : (
        <EntityDrilldown level={level} groups={level === "adset" ? funnelLevels?.adset ?? [] : funnelLevels?.campaign ?? []} />
      )}
    </>
  );
}
