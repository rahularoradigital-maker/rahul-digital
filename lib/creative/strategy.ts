// Creative-strategy engine - the read a top-0.1% creative strategist spending $100M/month actually makes.
// Diversity (spread) is table stakes; the money questions are:
//   1. WINNING DNA - which specific creative attributes actually drive winners here? (what to double down on)
//   2. FRAGILITY - is the account carried by a couple of creatives, and are they fatiguing? (the real risk)
//   3. PROVEN WHITE-SPACE - which winning angle are we under-investing in? (the growth lever)
//   4. PRODUCTION BRIEF - concretely, what to make next, and why (grounded in 1-3, never generic)
// Fatigue/liveness-aware: a diverse set of dead ads is not diversity, and a winner that is fatiguing is a
// risk, not a strength. Pure, no I/O. Never fabricates - every claim is backed by real spend + winner data.

import type { CreativeRecord, DiversityRead, WhiteSpace } from "./diversity.ts";

// calibrate-at-build.
const PROVEN = 60; // avg winner at/above this = the attribute demonstrably works
const MIN_EVIDENCE = 2; // need at least this many ads in a bucket before calling it "proven" (not a fluke)
const FRAGILE_TOP2 = 0.5; // >=50% of spend on the top 2 creatives = concentrated
const THIN_SHARE = 0.15; // an attribute below this share of spend is under-invested

export type DnaSignal = { dimension: string; attribute: string; avgWinner: number; lift: number; spendShare: number; ads: number };
export type Fragility = {
  topCreativeShare: number; // spend share of the single biggest creative
  top2Share: number;
  winnerHHI: number; // 0..1 concentration of spend across individual creatives (1 = all on one)
  fatiguingWinnerShare: number; // share of spend on creatives that both WIN and are fatiguing (the exposure)
  level: "low" | "medium" | "high";
  note: string;
};
export type BriefItem = { make: string; because: string; priority: number };
export type CreativeStrategy = {
  winningDNA: DnaSignal[];
  fragility: Fragility;
  whitespace: WhiteSpace[];
  brief: BriefItem[];
  liveShare: number; // share of spend on delivering, non-fatigued creatives (what is actually working NOW)
  summary: string; // the strategist's one-paragraph read
  label: "INTERNAL CALCULATION";
};

const pct = (x: number) => Math.round(x * 100);

// The attributes that correlate with winning: for every dimension bucket with enough evidence and a
// proven avg winner, its LIFT over the account's spend-weighted average winner. Ranked by impact
// (lift x spend share) so the biggest, most-proven levers come first.
function winningDNA(records: CreativeRecord[], diversity: DiversityRead): DnaSignal[] {
  const totalSpend = records.reduce((a, r) => a + r.spendRs, 0) || 1;
  const acctAvg = records.reduce((a, r) => a + r.winner * r.spendRs, 0) / totalSpend; // spend-weighted baseline
  const signals: DnaSignal[] = [];
  for (const d of diversity.dimensions) {
    if (d.activeBuckets < 2) continue; // "what wins" needs a contrast
    for (const b of d.buckets) {
      if (b.count < MIN_EVIDENCE || b.avgWinner < PROVEN) continue;
      const lift = b.avgWinner - acctAvg;
      if (lift <= 0) continue;
      signals.push({ dimension: d.dimension, attribute: b.name, avgWinner: Math.round(b.avgWinner), lift: Math.round(lift), spendShare: b.spendShare, ads: b.count });
    }
  }
  return signals.sort((a, b) => b.lift * b.spendShare - a.lift * a.spendShare).slice(0, 6);
}

// Portfolio fragility: how exposed is the account if a couple of creatives break? Concentration of spend
// across individual creatives + whether the load-bearing ones are fatiguing.
function fragilityOf(records: CreativeRecord[]): Fragility {
  const total = records.reduce((a, r) => a + r.spendRs, 0) || 1;
  const sorted = [...records].sort((a, b) => b.spendRs - a.spendRs);
  const topCreativeShare = (sorted[0]?.spendRs ?? 0) / total;
  const top2Share = ((sorted[0]?.spendRs ?? 0) + (sorted[1]?.spendRs ?? 0)) / total;
  const winnerHHI = records.reduce((a, r) => a + (r.spendRs / total) ** 2, 0);
  // Exposure: spend on creatives that are genuinely working (proven winner) yet fatiguing - the ones you
  // rely on that are decaying. This is where a $100M account quietly falls off a cliff.
  const fatiguingWinnerShare = records.filter((r) => r.winner >= PROVEN && r.fatigued).reduce((a, r) => a + r.spendRs, 0) / total;

  const concentrated = top2Share >= FRAGILE_TOP2;
  const decaying = fatiguingWinnerShare >= 0.2;
  const level: Fragility["level"] = concentrated && decaying ? "high" : concentrated || decaying ? "medium" : "low";
  const note =
    level === "high"
      ? `High: ${pct(top2Share)}% of spend rides your top 2 creatives, and ${pct(fatiguingWinnerShare)}% sits on winners that are fatiguing. One decay and results fall.`
      : level === "medium"
        ? concentrated
          ? `Medium: ${pct(top2Share)}% of spend on the top 2 creatives - thin portfolio; broaden the winner base.`
          : `Medium: ${pct(fatiguingWinnerShare)}% of spend on fatiguing winners - refresh them before they decay.`
        : `Low: spend is spread across enough live winners to absorb a creative breaking.`;
  return { topCreativeShare, top2Share, winnerHHI, fatiguingWinnerShare, level, note };
}

// The production brief: concrete next-makes, grounded. (1) scale proven-but-thin white-space, (2) refresh
// fatiguing winners keeping their proven DNA, (3) replicate the strongest winning DNA into a fresh execution.
function buildBrief(records: CreativeRecord[], dna: DnaSignal[], whitespace: WhiteSpace[], frag: Fragility): BriefItem[] {
  const brief: BriefItem[] = [];
  for (const w of whitespace.slice(0, 3)) {
    brief.push({ make: `More "${w.bucket}" ${w.dimension} creatives`, because: `${w.reason} - scale a proven angle you are under-backing`, priority: Math.round(w.avgWinner + w.spendShare * 10) });
  }
  if (frag.fatiguingWinnerShare >= 0.2) {
    const fw = [...records].filter((r) => r.winner >= PROVEN && r.fatigued).sort((a, b) => b.spendRs - a.spendRs)[0];
    if (fw) brief.push({ make: `A fresh execution of "${fw.adName}"`, because: `it is a proven winner but fatiguing (${pct(fw.spendRs / (records.reduce((a, r) => a + r.spendRs, 0) || 1))}% of spend) - keep the angle, new hook/visual`, priority: 95 });
  }
  if (dna[0]) {
    brief.push({ make: `A new creative leading with ${dna[0].attribute} (${dna[0].dimension})`, because: `your strongest winning pattern (+${dna[0].lift} vs account average) - make more variants of it`, priority: 90 });
  }
  return brief.sort((a, b) => b.priority - a.priority).slice(0, 6);
}

export function buildCreativeStrategy(records: CreativeRecord[], diversity: DiversityRead): CreativeStrategy {
  const total = records.reduce((a, r) => a + r.spendRs, 0) || 1;
  const liveShare = records.filter((r) => r.delivering !== false && !r.fatigued).reduce((a, r) => a + r.spendRs, 0) / total;
  const dna = winningDNA(records, diversity);
  const fragility = fragilityOf(records);
  const brief = buildBrief(records, dna, diversity.whitespace, fragility);

  const dnaPhrase = dna.length ? `Winners here skew ${dna.slice(0, 3).map((s) => `${s.attribute}`).join(" + ")}.` : `No single attribute clearly out-wins yet - keep testing angles.`;
  const wsPhrase = diversity.whitespace.length ? ` Proven-but-thin: ${diversity.whitespace[0].bucket} (${diversity.whitespace[0].dimension}) wins but is only ${pct(diversity.whitespace[0].spendShare)}% of spend.` : "";
  const summary = `${dnaPhrase} ${fragility.note}${wsPhrase} ${pct(liveShare)}% of spend is on live, non-fatigued creatives.`;

  return { winningDNA: dna, fragility, whitespace: diversity.whitespace, brief, liveShare, summary, label: "INTERNAL CALCULATION" };
}
