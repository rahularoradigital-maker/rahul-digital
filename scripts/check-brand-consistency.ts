// SEO regression gate: ONE brand, everywhere. The product is "AdScale"; the old name "AdBrain" must never
// come back (it split the entity across the site and confused search + answer engines). This walks the
// source and FAILS if the obsolete brand token reappears. No frameworks.
// Run: node --experimental-strip-types scripts/check-brand-consistency.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["app", "components", "lib", "scripts"];
const EXT = /\.(ts|tsx|mjs)$/;
// Ban the obsolete brand NAME as a word (\badbrain\b). The word boundary already spares COMPOUND code
// identifiers ("AdBrainLinks", "tagAdBrainLinks", "AdBrainScout", "adbrainFit") - there is no boundary
// between "adbrain" and the next letter. It would still catch the preserved technical tokens that end on a
// non-word char (the "adbrain." cookie names, "adbrain-mvp/-decision" file keys, "ADBRAIN_PERF" env flag),
// so those are stripped from each line before the test - they are internal state keys, never user-facing brand.
const BANNED = /\badbrain\b/i;
const ALLOW =
  /adbrain\.(campaign|campaigns|objectives|platform|catalog|weights|window|events|eventOptions|accounts|brands|kpis|competitors|lastEmail|margin)|adbrain-mvp|adbrain-decision|ADBRAIN_PERF|ADBRAIN\.test/gi;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      out.push(...walk(p));
    } else if (EXT.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const SELF = "check-brand-consistency.ts"; // this gate necessarily contains the banned token (regex + docs)
const hits: string[] = [];
for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    if (file.endsWith(SELF)) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const stripped = line.replace(ALLOW, ""); // drop the allowed technical tokens, then test the remainder
      if (BANNED.test(stripped)) hits.push(`${file.replace(ROOT, "")}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
}

assert.equal(hits.length, 0, `brand consistency: ${hits.length} banned brand token(s) present - the product is "AdScale", never "AdBrain":\n${hits.join("\n")}`);
console.log(`OK check-brand-consistency: the obsolete brand word "AdBrain" appears nowhere across ${DIRS.join("/")} (preserved adbrain.* state keys are allowed).`);
