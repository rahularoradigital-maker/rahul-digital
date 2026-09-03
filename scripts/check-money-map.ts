// Proof for the event money-map HTML export (lib/scoring/money-map): complete escaped doc, ROI only where
// revenue exists, honest fallback when empty.
// Run: node --experimental-strip-types scripts/check-money-map.ts
import { computeEventRoi } from "../lib/scoring/event-roi.ts";
import { eventMoneyMapHtml } from "../lib/scoring/money-map.ts";
let pass = 0;
function ok(c: boolean, m: string) { if (!c) throw new Error("FAIL: " + m); pass++; }
const rows = computeEventRoi([
  { event: "PURCHASE", spendRs: 7568096, revenueRs: 41177351, purchases: 15309 },
  { event: "CONTENT_VIEW", spendRs: 134598, revenueRs: 21695, purchases: 11 },
  { event: "REACH", spendRs: 13199, revenueRs: 0, purchases: 0 },
]);
const html = eventMoneyMapHtml(rows, { accountName: "A & <b>Co</b>", window: "last 90 days" });
ok(/^<!doctype html>/i.test(html) && /<\/html>$/i.test(html.trim()), "complete html document");
ok(/Purchase/.test(html) && /\+444%/.test(html), "renders the event rows + ROI");
ok(/n\/a - no revenue/.test(html), "no-revenue event shows n/a, not a fake ROI");
ok(html.includes("A &amp; &lt;b&gt;Co&lt;/b&gt;") && !html.includes("<b>Co</b>"), "account name is HTML-escaped (no injection)");
ok(/directional/.test(html), "thin-sample event flagged directional in the map");
ok(/No event data yet/.test(eventMoneyMapHtml([])), "empty -> honest fallback, no fabricated rows");
console.log(`check-money-map: ${pass} assertions passed.`);
