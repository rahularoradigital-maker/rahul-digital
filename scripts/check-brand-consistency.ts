// SEO regression gate: ONE brand, everywhere. The product is "AdBrain"; the old name "AdScale" /
// "adscaledigital.co" must never come back (it split the entity across the site and confused search +
// answer engines). This walks the source and FAILS if any banned brand token reappears. No frameworks.
// Run: node --experimental-strip-types scripts/check-brand-consistency.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname;
const DIRS = ["app", "components", "lib", "scripts"];
const EXT = /\.(ts|tsx|mjs)$/;
const BANNED = /adscale|adscaledigital/i;

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
      if (BANNED.test(line)) hits.push(`${file.replace(ROOT, "")}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
}

assert.equal(hits.length, 0, `brand consistency: ${hits.length} banned brand token(s) present - the product is "AdBrain", never "AdScale":\n${hits.join("\n")}`);
console.log(`OK check-brand-consistency: no banned brand tokens (adscale/adscaledigital) across ${DIRS.join("/")}.`);
