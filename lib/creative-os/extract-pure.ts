// Phase 2 — pattern extraction, PURE core (no I/O, no server-only) so the check imports it directly.
// Turns a creative's raw signal (caption / transcript / text overlay / top comments / review text) into
// CreativePattern drafts against the shared taxonomy. The Gemini call + DB write live in ./extract.ts.
// Relative + .ts so the check runner (node --experimental-strip-types) resolves the VALUE imports
// (PATTERN_TYPES, isPatternType); the `@/` alias only resolves under tsc/Next.
import { PATTERN_TYPES, isPatternType, type CreativePattern, type PatternSource } from "./schema.ts";

// A pattern before it hits the DB (the DB assigns id + created_at).
export type PatternDraft = Omit<CreativePattern, "id" | "createdAt">;

export type ExtractInput = {
  caption?: string | null;
  transcript?: string | null;
  textOverlay?: string | null;
  comments?: string[] | null; // top audience comments (voice-of-customer signal)
  reviewText?: string | null; // for source=review
};

export type ExtractContext = { brandId: string | null; source: PatternSource; sourceRef: string | null };

// Build the extraction prompt. Asks for STRICT JSON so parsing is deterministic; names the exact taxonomy so
// the model can't invent a type. "Only what is actually present" — no fabricated patterns (charter honesty).
export function buildExtractPrompt(input: ExtractInput): string {
  const parts: string[] = [];
  if (input.caption) parts.push(`CAPTION:\n${input.caption}`);
  if (input.textOverlay) parts.push(`ON-SCREEN TEXT:\n${input.textOverlay}`);
  if (input.transcript) parts.push(`TRANSCRIPT:\n${input.transcript}`);
  if (input.reviewText) parts.push(`REVIEW TEXT:\n${input.reviewText}`);
  if (input.comments?.length) parts.push(`TOP COMMENTS:\n${input.comments.slice(0, 30).join("\n")}`);
  const body = parts.join("\n\n") || "(no content)";
  return [
    "You are a performance-creative analyst. Extract the reusable creative patterns that are ACTUALLY PRESENT in the material below.",
    `Return ONLY a JSON array. Each item: {"type": one of ${JSON.stringify(PATTERN_TYPES)}, "text": "the pattern in the real observed wording, one line", "evidence": "optional short quote/why"}.`,
    "Rules: extract only what is present; use the creator's / customer's real words for hooks and language; do NOT invent personas or proof that is not shown; omit a type if it is not present. No prose outside the JSON.",
    "",
    body,
  ].join("\n");
}

// Parse the model's JSON into validated drafts. Fail-safe: bad JSON or unknown types are dropped, never thrown.
export function parsePatterns(raw: string | null, ctx: ExtractContext): PatternDraft[] {
  if (!raw) return [];
  let arr: unknown;
  try {
    // tolerate ```json fences the model sometimes adds
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    arr = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: PatternDraft[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const type = String((item as Record<string, unknown>).type ?? "");
    const text = String((item as Record<string, unknown>).text ?? "").trim();
    if (!isPatternType(type) || !text) continue;
    const evRaw = (item as Record<string, unknown>).evidence;
    out.push({
      brandId: ctx.brandId,
      type,
      text: text.slice(0, 500),
      source: ctx.source,
      sourceRef: ctx.sourceRef,
      performance: null,
      evidence: evRaw ? { note: String(evRaw).slice(0, 500) } : null,
    });
  }
  return dedupePatterns(out);
}

// Collapse duplicates within one extraction by (type + normalized text). Keeps the taxonomy tidy per source.
export function dedupePatterns(drafts: PatternDraft[]): PatternDraft[] {
  const seen = new Set<string>();
  const out: PatternDraft[] = [];
  for (const d of drafts) {
    const key = `${d.type}::${d.text.toLowerCase().replace(/\s+/g, " ").trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(d);
  }
  return out;
}
