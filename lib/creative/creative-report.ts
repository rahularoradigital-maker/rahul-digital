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

// A minimal per-ad shape for the best-vs-worst pick, so the logic stays pure/testable.
export type AdBrief = { id: string; name: string; score: number; verdict: string; spendRs: number; fatigueState: string | null; actionLabel: string };

// The account's clearest winner vs its clearest fading ad - an instant "what's working vs what's dying" read.
// best = highest-scoring proven winner (falls back to the highest-scoring ad if there are no winners yet);
// worst = lowest-scoring ad the engine flagged to refresh/kill. Never returns the same ad as both.
export function pickBestWorst(ads: AdBrief[]): { best: AdBrief | null; worst: AdBrief | null } {
  if (ads.length === 0) return { best: null, worst: null };
  const winners = ads.filter((a) => a.verdict === "winner");
  const best = (winners.length ? winners : ads).reduce((x, y) => (y.score > x.score ? y : x));
  const dying = ads.filter((a) => a.verdict === "loser" || a.verdict === "refresh");
  const worst = dying.length ? dying.reduce((x, y) => (y.score < x.score ? y : x)) : null;
  if (best && worst && best.id === worst.id) return { best, worst: null };
  return { best, worst };
}

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

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Standalone, styled HTML render - a buyer can open it in a browser or send it to a client. Self-contained
// (inline CSS, no external assets), and every dynamic string is HTML-escaped so account/format names cannot
// inject markup. Palette matches the app (light ground, ink text, blue accent).
export function reportToHtml(r: CreativeReport): string {
  const sections = r.sections
    .map(
      (s) =>
        `<section><h2>${esc(s.title)}</h2><ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></section>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Creative health report - ${esc(r.generatedFor)}</title><style>
:root{--bg:#f7f7f7;--surface:#fff;--ink:#252525;--muted:#6b6b6b;--accent:#0a66c2;--hairline:#e4e4e4}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:32px}
.wrap{max-width:760px;margin:0 auto}.eyebrow{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--accent);font-weight:600}
h1{font-size:24px;font-weight:400;margin:4px 0 2px}.for{color:var(--muted);font-size:13px;margin-bottom:20px}
.headline{font-size:17px;font-weight:500;margin:0 0 24px;padding:16px;background:var(--surface);border:1px solid var(--hairline);border-radius:12px}
.grid{display:grid;gap:16px;grid-template-columns:1fr}@media(min-width:640px){.grid{grid-template-columns:1fr 1fr}}
section{background:var(--surface);border:1px solid var(--hairline);border-radius:12px;padding:16px}
h2{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:0 0 8px}
ul{margin:0;padding-left:18px}li{margin:4px 0}.foot{color:var(--muted);font-size:12px;margin-top:24px;text-align:center}
</style></head><body><div class="wrap"><div class="eyebrow">AdScale</div><h1>Creative health report</h1><div class="for">${esc(r.generatedFor)}</div><div class="headline">${esc(r.headline)}</div><div class="grid">${sections}</div><div class="foot">Generated by AdScale from your connected account. Deterministic - no figure is estimated.</div></div></body></html>`;
}
