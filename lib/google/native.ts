// Assembles the Google-native view the dashboard shows ABOVE the shared cockpit: the lead metrics
// (spend-weighted "most effective on top") with real values, plus the ranked engine findings. Pure, so it
// is node-gate-able and has no Meta/DB coupling. In DEMO mode it runs off the deterministic demo account;
// when the real Google Ads client lands, swap demoGoogleAccount() for the fetched snapshot - nothing else changes.

import type { GoogleCampaignType } from "./campaign-types.ts";
import type { GoogleAccountSnapshot } from "./types.ts";
import { demoGoogleAccount } from "./demo-account.ts";
import { diagnoseGoogleAccount, type GoogleDiagnosis } from "./diagnosis.ts";
import { accountTopMetrics, type MetricKey } from "./metric-priority.ts";

export type GoogleTopMetric = { key: MetricKey; label: string; why: string; value: string };

export type GoogleNative = {
  leadType: GoogleCampaignType;
  leadLabel: string;
  northStar: string;
  topMetrics: GoogleTopMetric[];
  diagnosis: GoogleDiagnosis;
  demo: boolean;
};

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (f: number) => `${Math.round(f * 100)}%`;

// Cost-weighted account aggregates (weight the levers by where the money is, not a flat mean).
function accountValues(snap: GoogleAccountSnapshot): Partial<Record<MetricKey, string>> {
  const cs = snap.campaigns;
  const totalCost = cs.reduce((a, c) => a + c.cost, 0);
  const totalVal = cs.reduce((a, c) => a + c.conversionValue, 0);
  const totalConv = cs.reduce((a, c) => a + c.conversions, 0);
  // Cost-weighted average of a per-campaign field, over only the campaigns that report it.
  const wavg = (pick: (c: (typeof cs)[number]) => number | null | undefined) => {
    let num = 0, den = 0;
    for (const c of cs) { const v = pick(c); if (v != null) { num += v * c.cost; den += c.cost; } }
    return den > 0 ? num / den : null;
  };
  const is = wavg((c) => c.impressionShare);
  const lb = wavg((c) => c.lostIsBudget);
  const lr = wavg((c) => c.lostIsRank);
  const qs = wavg((c) => c.qualityScore);
  return {
    roas: totalCost > 0 ? `${(totalVal / totalCost).toFixed(2)}x` : "-",
    conversion_value: rupees(totalVal),
    conversions: `${Math.round(totalConv)}`,
    cpa: totalConv > 0 ? rupees(totalCost / totalConv) : "-",
    impression_share: is != null ? pct(is) : undefined,
    lost_is_budget: lb != null ? pct(lb) : undefined,
    lost_is_rank: lr != null ? pct(lr) : undefined,
    quality_score: qs != null ? `${qs.toFixed(1)}/10` : undefined,
  };
}

export function buildGoogleNative(snapshot?: GoogleAccountSnapshot): GoogleNative {
  const snap = snapshot ?? demoGoogleAccount();
  const spendByType: Partial<Record<GoogleCampaignType, number>> = {};
  for (const c of snap.campaigns) spendByType[c.type] = (spendByType[c.type] ?? 0) + c.cost;

  const lead = accountTopMetrics(spendByType);
  const values = accountValues(snap);
  // Lead with the type's ordered stack, but only metrics we actually have a value for (honest, no blanks).
  const topMetrics: GoogleTopMetric[] = lead.metrics
    .filter((m) => values[m.key] != null)
    .map((m) => ({ key: m.key, label: m.label, why: m.why, value: values[m.key]! }));

  return {
    leadType: lead.leadType,
    leadLabel: lead.spec.label,
    northStar: lead.spec.northStar,
    topMetrics,
    diagnosis: diagnoseGoogleAccount(snap),
    demo: !snapshot, // no real snapshot passed => demo data
  };
}
