// Proof for Scout's attribution tagging: AdScale links get consistent UTMs; tagging is idempotent; non-AdScale
// links are untouched. Run: node --experimental-strip-types scripts/check-attribution-utm.ts

import { utmLink, tagAdBrainLinks } from "../lib/growth/attribution.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const link = utmLink("/", { source: "Reddit", content: "creative fatigue" });
ok(link.startsWith("https://adscaledigital.co/"), "utmLink points at adscaledigital.co");
ok(link.includes("utm_source=reddit"), "source is set + cleaned to lowercase");
ok(link.includes("utm_medium=scout"), "medium defaults to scout");
ok(link.includes("utm_campaign=growth"), "campaign defaults to growth");
ok(link.includes("utm_content=creative-fatigue"), "content set + slugified");

const tagged = tagAdBrainLinks("Try https://adscaledigital.co/app for this.", { source: "hackernews", content: "t1" });
ok(tagged.includes("utm_source=hackernews"), "a bare AdScale link in text gets tagged");
ok(/adscaledigital\.co\/app\?/.test(tagged), "the app path is preserved + query appended");

// idempotent: re-tagging doesn't double-append
const twice = tagAdBrainLinks(tagged, { source: "hackernews", content: "t1" });
ok((twice.match(/utm_source=/g) || []).length === 1, "already-tagged link is not tagged again");

// non-AdScale links are untouched
const other = tagAdBrainLinks("See https://example.com/x and https://reddit.com/r/PPC", { source: "reddit" });
ok(!other.includes("utm_source"), "non-AdScale links are left alone");

console.log(`check-attribution-utm: ${pass} assertions passed.`);
