// Adapter: the creative diversity read (DiversityRead, from lib/creative/diversity) -> the §110 Output
// Contract, focused on §36 portfolio FRAGILITY (spend concentrated in one bucket = a single point of failure).
// New file, no engine edit. TRUST gate: if too few ads carry a semantic read (low coverage), we cannot judge
// the mix honestly -> HOLD (§55). The caller passes account spend so the concentration can be sized in ₹.

import type { DiversityRead } from "@/lib/creative/diversity";
import { hold, decide, type OutputContract, type Confidence } from "./output-contract.ts";

const MIN_COVERAGE = 0.4; // below this share of ads with a semantic read, the mix can't be judged
const FRAGILE_SHARE = 0.6; // one bucket holding >=60% of spend = fragile concentration
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function diversityToContract(read: DiversityRead, opts: { entityId: string; accountSpendRs: number }): OutputContract | null {
  const data = { summary: `Creative diversity ${Math.round(read.overall)}/100 · ${Math.round(read.coverage * 100)}% of ads read`, source: "meta-store" as const };
  const entity = { level: "account" as const, id: opts.entityId };

  if (read.coverage < MIN_COVERAGE) {
    return hold({
      id: `diversity:${opts.entityId}`, kind: "diversity", entity, data, tier: "CALCULATED",
      reason: `only ${Math.round(read.coverage * 100)}% of ads carry a semantic read (need >=${MIN_COVERAGE * 100}%)`,
      whatToDo: "Too few ads are analysed to judge the creative mix - decode more creatives first.",
      confidence: "low",
    });
  }

  // The most concentrated dimension that names a dominant bucket.
  const worst = read.dimensions
    .filter((d) => d.dominant && d.dominantShare > 0)
    .sort((a, b) => b.dominantShare - a.dominantShare)[0];
  if (!worst || worst.dominantShare < FRAGILE_SHARE) return null; // diverse enough -> nothing to flag

  const concentratedRs = worst.dominantShare * opts.accountSpendRs;
  const share = Math.round(worst.dominantShare * 100);
  const wl = read.whitespace[0];
  const conf: Confidence = worst.dominantShare >= 0.75 ? "high" : "med";
  return decide({
    id: `diversity:${opts.entityId}`, kind: "diversity", entity, data, tier: "CALCULATED",
    trustReason: `${Math.round(read.coverage * 100)}% of ads carry a semantic read - enough to judge the mix`,
    signal: `${share}% of spend sits in one ${worst.dimension} bucket ("${worst.dominant}")`,
    diagnosis: `The portfolio is fragile on ${worst.dimension}: a single bucket ("${worst.dominant}") carries ${share}% of spend, so if it fatigues there is little tested backup to catch the account.`,
    economicImpactRs: concentratedRs,
    secondOrder: "If that bucket fatigues, its whole budget needs somewhere to go at once - and there is no proven alternative ready to absorb it.",
    thirdOrder: "Repeated single-bucket dependence means every acquisition target rides on one idea; the account's growth becomes brittle as it scales.",
    decision: { call: `Diversify the ${worst.dimension}`, why: `${share}% concentration is a single point of failure` },
    action: wl
      ? `Draft tests in the under-backed winner "${wl.bucket}" (${wl.dimension}) - it already performs but barely gets spend.`
      : `Draft 2-3 creatives in a different ${worst.dimension} to build a tested backup before the dominant bucket fatigues.`,
    whatCouldBeWrong: "If the dominant bucket is genuinely your best and still fresh, some concentration is fine - fragility bites only when it starts to fatigue.",
    confidence: conf,
    sampleNote: `${read.dimensions.length} dimensions read`,
  });
}
