// Creative health report: a deterministic, plain-English summary of the account's creative state, assembled
// from numbers the cockpit already computes (no AI, no new data). Pure + testable; the section component
// feeds it real values and the card renders + downloads it. Every line is honest - if a number is missing
// it says so instead of inventing one.

export type ReportInput = {
  accountName: string;
  days: number;
  healthScore: number | null;
  adsAssessed: number;
  fatiguing: number;
  winners: number;
  top1SharePct: number | null; // share of spend on the single biggest ad, 0-100
  dominantFormat: string | null;
  wasteRs: number | null;
  opportunityLossRs: number | null;
  deepReadCount: number;
};

export type ReportSection = { title: string; lines: string[] };
export type CreativeReport = { headline: string; generatedFor: string; sections: ReportSection[] };

const inr = (n: number) => "Rs " + Math.round(n).toLocaleString("en-IN");

export function buildCreativeReport(i: ReportInput): CreativeReport {
  const health = i.healthScore === null ? "not enough data yet" : `${i.healthScore}/100`;
  const headline =
    i.adsAssessed === 0
      ? "No ads assessed yet."
      : `${i.fatiguing} of ${i.adsAssessed} ad${i.adsAssessed === 1 ? "" : "s"} fatiguing; creative health ${health}.`;

  const health_section: ReportSection = {
    title: "Health",
    lines: [
      i.healthScore === null ? "Creative health: not enough delivery to score yet." : `Creative health: ${i.healthScore}/100.`,
      `${i.adsAssessed} ad${i.adsAssessed === 1 ? "" : "s"} assessed over the last ${i.days} days.`,
    ],
  };

  const fatigue_section: ReportSection = {
    title: "Fatigue & winners",
    lines: [
      i.fatiguing === 0 ? "Nothing is fatiguing right now." : `${i.fatiguing} ad${i.fatiguing === 1 ? " is" : "s are"} fatiguing or fatigued.`,
      i.winners === 0 ? "No clear winners at the moment." : `${i.winners} proven winner${i.winners === 1 ? "" : "s"}.`,
    ],
  };

  const concentration_section: ReportSection = {
    title: "Concentration",
    lines: [
      i.top1SharePct === null
        ? "Not enough spend to assess concentration."
        : i.top1SharePct >= 50
          ? `Fragile: ${i.top1SharePct}% of spend rides on one ad. If it fatigues, most of your spend is exposed at once.`
          : `${i.top1SharePct}% of spend on the single biggest ad - reasonably spread.`,
      i.dominantFormat ? `Most spend is in the "${i.dominantFormat}" format.` : "",
    ].filter(Boolean),
  };

  const money_lines: string[] = [];
  if (i.wasteRs !== null && i.wasteRs > 0) money_lines.push(`Waste (spend on ads that are not working): ${inr(i.wasteRs)}.`);
  if (i.opportunityLossRs !== null && i.opportunityLossRs > 0) money_lines.push(`Opportunity loss (money left on the table): ${inr(i.opportunityLossRs)}.`);
  if (money_lines.length === 0) money_lines.push("No material waste or opportunity loss detected in this window.");
  const money_section: ReportSection = { title: "Money at stake", lines: money_lines };

  const dna_section: ReportSection = {
    title: "Creative DNA",
    lines: [i.deepReadCount > 0 ? `${i.deepReadCount} of your top spenders were read as real video motion (deep analysis).` : "Run the deep read to analyse your top spenders' video motion, not just cover frames."],
  };

  // Deterministic "what to do" - only the actions the numbers actually support.
  const todo: string[] = [];
  if (i.fatiguing > 0) todo.push("Refresh or replace the fatiguing ads before they decay further.");
  if (i.top1SharePct !== null && i.top1SharePct >= 50) todo.push("Diversify: build a second winner so one ad's fatigue does not sink the account.");
  if (i.opportunityLossRs !== null && i.opportunityLossRs > 0 && i.winners > 0) todo.push("Scale the proven winners that still have room.");
  if (todo.length === 0) todo.push("Hold: nothing needs an urgent creative change right now.");
  const todo_section: ReportSection = { title: "What to do", lines: todo };

  return {
    headline,
    generatedFor: `${i.accountName} - last ${i.days} days`,
    sections: [health_section, fatigue_section, concentration_section, money_section, dna_section, todo_section],
  };
}

// Plain-text render for copy / download.
export function reportToText(r: CreativeReport): string {
  const body = r.sections.map((s) => `${s.title}\n${s.lines.map((l) => `  - ${l}`).join("\n")}`).join("\n\n");
  return `Creative health report\n${r.generatedFor}\n\n${r.headline}\n\n${body}\n`;
}
