// Runnable check: the semantic verdict chips (Scale/Iterate/Kill) render ink-on-tint at 11px, so each pair
// must clear WCAG AA for small text (4.5:1). This reads the real token values out of app/globals.css (not a
// hardcoded copy) and fails if any pair regresses - so a future re-lightening of --good-ink etc. is caught.
// Run: npm run check:contrast

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token --${name} not found in globals.css`);
  return m![1].toLowerCase();
}

function relLum(hex: string): number {
  const c = hex.replace("#", "").match(/../g)!.map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const L1 = relLum(a), L2 = relLum(b);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_SMALL = 4.5;
const pairs: [string, string, string][] = [
  ["good", "good-ink", "good-bg"],
  ["warn", "warn-ink", "warn-bg"],
  ["bad", "bad-ink", "bad-bg"],
];

let worst = Infinity;
for (const [label, inkTok, bgTok] of pairs) {
  const r = contrast(token(inkTok), token(bgTok));
  worst = Math.min(worst, r);
  assert.ok(r >= AA_SMALL, `${label}: ink-on-tint contrast ${r.toFixed(2)}:1 is below WCAG AA small-text ${AA_SMALL}:1 (chips use 11px). Darken --${inkTok}.`);
}
console.log(`PASS: verdict-chip contrast - all 3 ink-on-tint pairs clear WCAG AA 4.5:1 (worst ${worst.toFixed(2)}:1).`);
