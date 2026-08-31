// Proof for Scout's attribution tagging: AdBrain links get consistent UTMs; tagging is idempotent; non-AdBrain
// links are untouched. Run: node --experimental-strip-types scripts/check-attribution-utm.ts

import { utmLink, tagAdBrainLinks } from "../lib/growth/attribution.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const link = utmLink("/", { source: "Reddit", content: "creative fatigue" });
ok(link.startsWith("https://rahul-digital.vercel.app/"), "utmLink points at rahul-digital.vercel.app");
ok(link.includes("utm_source=reddit"), "source is set + cleaned to lowercase");
ok(link.includes("utm_medium=scout"), "medium defaults to scout");
ok(link.includes("utm_campaign=growth"), "campaign defaults to growth");
ok(link.includes("utm_content=creative-fatigue"), "content set + slugified");

const tagged = tagAdBrainLinks("Try https://rahul-digital.vercel.app/app for this.", { source: "hackernews", content: "t1" });
ok(tagged.includes("utm_source=hackernews"), "a bare AdBrain link in text gets tagged");
ok(/rahul-digital\.vercel\.app\/app\?/.test(tagged), "the app path is preserved + query appended");

// idempotent: re-tagging doesn't double-append
const twice = tagAdBrainLinks(tagged, { source: "hackernews", content: "t1" });
ok((twice.match(/utm_source=/g) || []).length === 1, "already-tagged link is not tagged again");

// non-AdBrain links are untouched
const other = tagAdBrainLinks("See https://example.com/x and https://reddit.com/r/PPC", { source: "reddit" });
ok(!other.includes("utm_source"), "non-AdBrain links are left alone");

console.log(`check-attribution-utm: ${pass} assertions passed.`);
