// Proof for the growth attribution readback (§22): only medium=scout signups are credited to Scout; content +
// source are ranked by signups; organic is never over-claimed. Run: node --experimental-strip-types scripts/check-attribution-readback.ts

import assert from "node:assert/strict";
import { attributeSignups, type SignupEvent } from "../lib/growth/attribution-readback.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const scout = (source: string, content: string): SignupEvent => ({ utmMedium: "scout", utmCampaign: "growth", utmSource: source, utmContent: content });

const events: SignupEvent[] = [
  scout("reddit", "creative-fatigue"),
  scout("reddit", "creative-fatigue"),
  scout("reddit", "creative-fatigue"),
  scout("hackernews", "attribution-guide"),
  scout("reddit", "attribution-guide"),
  { utmMedium: "organic" }, // not Scout
  {}, // direct, no utm
];

const r = attributeSignups(events);
ok(r.totalSignups === 7, "counts all signups");
ok(r.scoutAttributed === 5 && r.organic === 2, "only medium=scout is credited to Scout; the rest is organic");
ok(r.topContent?.content === "creative-fatigue" && r.topContent?.signups === 3, "top content is the 3-signup fatigue piece");
ok(r.bySource[0].source === "reddit" && r.bySource[0].signups === 4, "reddit is the top source with 4 scout signups");
ok(r.byContent.length === 3, "three distinct source×content pairs");
// never over-claims: an all-organic set credits Scout with nothing.
const none = attributeSignups([{ utmMedium: "organic" }, {}]);
ok(none.scoutAttributed === 0 && none.topContent === null && none.totalSignups === 2, "all-organic -> zero Scout credit");

console.log(`check-attribution-readback: ${pass} assertions passed (top: ${r.topContent?.content} ${r.topContent?.signups}).`);
