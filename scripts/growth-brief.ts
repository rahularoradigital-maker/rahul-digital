// The 24/7 no-touch runner: discover (free Reddit public search) -> score -> decide -> write a daily brief.
// DRAFTS ONLY - it never posts anything. Safe to run on a schedule with zero human input.
// Run: node --experimental-strip-types scripts/growth-brief.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { discoverReddit, discoverHN } from "../lib/growth/discover.ts";
import { generateBrief, briefToMarkdown } from "../lib/growth/brief.ts";
import { INTENT_SIGNALS } from "../lib/growth/knowledge.ts";

// A small, polite set of the strongest intent queries (one phrase per topic) - never a scraper flood.
const queries = INTENT_SIGNALS.map((s) => s.phrases[0]).slice(0, 6);

const now = Date.now();
// Combine every free, no-touch source that actually works from a server. HN works today; Reddit returns [] until
// its official API is authorized (a one-time free app), then it joins automatically behind the same shape.
const [hn, reddit] = await Promise.all([discoverHN(queries), discoverReddit(queries)]);
const conversations = [...hn, ...reddit];
const brief = generateBrief(conversations, now);
const md = briefToMarkdown(brief);

const day = new Date(now).toISOString().slice(0, 10);
mkdirSync("docs/growth/briefs", { recursive: true });
const path = `docs/growth/briefs/${day}.md`;
writeFileSync(path, md);
console.log(`growth-brief: discovered ${brief.discovered}, ${brief.topOpportunities.length} draftable, ${brief.demandSignals.length} demand signals. Wrote ${path}`);
