// Deterministic grounding check for Ask answers (ISSUE 28). The prompt already tells Gemini every
// number must appear in the DATA, but prompt-only enforcement is weak. This collects every number in
// the DATA snapshot and flags any "specific" number in the answer that is not grounded in it, so the
// route can regenerate once with a stricter template. Pure + tolerant by design: small counts and
// numbers within a rounding tolerance of a real value are allowed, so legitimate answers are not
// falsely rejected.

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Every number appearing anywhere in a value (recursively), normalized. Strings are scanned too, so a
// formatted "Rs 55,010" or "4.43x" contributes 55010 / 4.43.
export function groundedNumbers(data: unknown, out: Set<number> = new Set()): Set<number> {
  if (typeof data === "number" && Number.isFinite(data)) out.add(round2(data));
  else if (typeof data === "string") for (const n of extractNumbers(data)) out.add(round2(n));
  else if (Array.isArray(data)) for (const v of data) groundedNumbers(v, out);
  else if (data && typeof data === "object") for (const v of Object.values(data)) groundedNumbers(v, out);
  return out;
}

export function extractNumbers(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(/-?\d[\d,]*\.?\d*/g)) {
    const n = parseFloat(m[0].replace(/,/g, ""));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

// Numbers in the answer that are NOT grounded in the DATA and are specific enough to be a fabrication.
// Grounded = equals a DATA number (rounded) or within 1% of one (formatting/rounding). Skipped: small
// integers <= 12 (list ordinals like "1 to 4", "top 8") which are phrasing, not claimed metrics.
export function ungroundedNumbers(answer: string, grounded: Set<number>): number[] {
  const g = [...grounded];
  const bad: number[] = [];
  for (const n of extractNumbers(answer)) {
    if (Number.isInteger(n) && Math.abs(n) <= 12) continue;
    const ok = g.some((x) => x === round2(n) || (x !== 0 && Math.abs(x - n) / Math.abs(x) <= 0.01));
    if (!ok) bad.push(n);
  }
  return bad;
}
