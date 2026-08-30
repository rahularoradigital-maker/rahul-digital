// Proves the spend-materiality gate: a declining-CTR ad that spent only a sliver of its ad set's budget
// must NOT read as fatiguing/half-life (media-buyer rule); the same ad at a healthy share reads normally.
import { readFatigue } from "../lib/scoring/fatigue.ts";
import type { MetricsRow } from "../lib/ad-source.ts";

const r = (date: string, spend: number, impressions: number, clicks: number): MetricsRow =>
  ({ date, spend, impressions, clicks, frequency: 2, revenue: 0, purchases: 0 } as unknown as MetricsRow);

// 6 days of steadily collapsing CTR (clicks fall on flat impressions) - would normally read as fatigue.
const rows: MetricsRow[] = [
  r("2026-08-01", 100, 10000, 345),
  r("2026-08-02", 100, 10000, 260),
  r("2026-08-03", 100, 10000, 170),
  r("2026-08-04", 100, 10000, 90),
  r("2026-08-05", 100, 10000, 35),
  r("2026-08-06", 100, 10000, 8),
];

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(c ? "  ok  " : "  FAIL", m); if (!c) fail++; };

const full = readFatigue(rows, {});
ok(full.sufficiency === "ok", `enough days -> a real read (${full.sufficiency})`);

const gated = readFatigue(rows, { spendShareOfAdSet: 0.04 }); // the user's 4% case
ok(gated.sufficiency === "insufficient_spend", `4% of ad-set spend -> insufficient_spend (${gated.sufficiency})`);
ok(gated.state !== "fatiguing" && gated.state !== "fatigued", `4% -> NOT fatiguing (${gated.state})`);
ok(gated.daysToFatigue === null, `4% -> no half-life number`);

const judged = readFatigue(rows, { spendShareOfAdSet: 0.30 }); // healthy share
ok(judged.sufficiency === "ok", `30% -> judged normally (${judged.sufficiency})`);

const boundary = readFatigue(rows, { spendShareOfAdSet: 0.20 }); // exactly at threshold = allowed
ok(boundary.sufficiency === "ok", `exactly 20% -> allowed (${boundary.sufficiency})`);

console.log(fail === 0 ? "\nFATIGUE-MATERIALITY GREEN" : `\nRED (${fail} failure(s))`);
process.exit(fail === 0 ? 0 : 1);
