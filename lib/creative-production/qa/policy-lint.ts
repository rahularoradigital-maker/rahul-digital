// Copy policy-lint (Studio improvement #5). Studio never invents claims, but it doesn't check the APPROVED
// copy against Meta's ad policies before a buyer uploads it - so a policy-tripping headline is only caught
// after Meta rejects the ad. This is a PURE, deterministic lint over the final copy: it flags likely-rejection
// phrasing so the buyer can fix it first. It is advisory (never blocks export) and never rewrites the copy.
//
// Grounded in Meta's documented prohibited/restricted patterns - not an invented rulebook:
//   - Personal attributes: implying you know a personal trait ("are you overweight?", "your diabetes").
//   - Before/after & unrealistic outcomes: "before and after", "lose 10kg", "guaranteed results".
//   - Health/finance claims & superlatives without proof: "cure", "100% guaranteed", "#1", "best in the world".
//   - Sensational / prohibited framing: "miracle", "shocking", monetary "$$$".
// Each finding names the phrase, the policy area, and a plain fix. No network, no model.

export type PolicyArea = "personal-attributes" | "before-after" | "unproven-claim" | "sensational";
export type PolicyFinding = { area: PolicyArea; phrase: string; where: string; why: string; fix: string };

type Rule = { area: PolicyArea; re: RegExp; why: string; fix: string };

const RULES: Rule[] = [
  { area: "personal-attributes", re: /\b(are you|do you have|your)\b[^.?!]*\b(overweight|obese|depress\w*|diabet\w*|anxiet\w*|bald|debt|divorc\w*|std|hiv)\b/i, why: "Meta bans copy that implies knowledge of a personal attribute (health, finances, etc.).", fix: "Speak to the benefit, not the person's condition (e.g. 'a lighter, more comfortable day')." },
  { area: "before-after", re: /\bbefore\s*(and|&|\/|,)?\s*after\b/i, why: "Before/after imagery and phrasing is restricted for health/beauty/finance.", fix: "Show the product and outcome without a transformation comparison." },
  { area: "before-after", re: /\b(lose|drop|shed)\s+\d+\s*(kg|kgs|kilos?|lbs?|pounds?|inches?)\b/i, why: "Specific weight/measurement-loss claims are restricted and often rejected.", fix: "Avoid a numeric loss promise; describe the experience instead." },
  { area: "unproven-claim", re: /\b(100%|totally|fully)\s*(guarantee\w*|risk[-\s]?free|effective)\b/i, why: "Absolute guarantees need substantiation and are commonly rejected.", fix: "Soften to what's true (e.g. '30-day returns') rather than an absolute guarantee." },
  { area: "unproven-claim", re: /\b(cure|cures|heals?|reverses?)\b/i, why: "Claiming to cure/heal is a prohibited health claim.", fix: "Describe support/relief you can substantiate, not a cure." },
  { area: "unproven-claim", re: /(#\s?1\b|\bnumber\s*one\b|\bno\.?\s*1\b|\bbest[-\s]?(selling|in[-\s]the[-\s]world)?\b|world'?s\s+best)/i, why: "Unqualified superlatives ('#1', 'best') need proof or they're rejected.", fix: "Qualify it ('#1 rated on <source>') or drop the superlative." },
  { area: "sensational", re: /\b(miracle|shocking|unbelievable|secret\s+they\s+don'?t\s+want)\b/i, why: "Sensational/clickbait framing is restricted.", fix: "State the real benefit plainly." },
  { area: "sensational", re: /\${2,}|₹{2,}|money[-\s]?back\s+guaranteed/i, why: "Exaggerated money framing reads as sensational and can be rejected.", fix: "Show the actual price/offer, not '$$$'." },
];

// Lint a piece of copy. `where` labels which field it came from (headline / body / cta / offer).
export function lintCopyField(text: string | null | undefined, where: string): PolicyFinding[] {
  if (!text) return [];
  const out: PolicyFinding[] = [];
  for (const r of RULES) {
    const m = text.match(r.re);
    if (m) out.push({ area: r.area, phrase: m[0], where, why: r.why, fix: r.fix });
  }
  return out;
}

// Lint a full ad's approved copy. Returns [] when the copy is clean (the common case).
export function lintAdCopy(copy: { headline?: string | null; supportingCopy?: string | null; cta?: string | null; offer?: string | null }): PolicyFinding[] {
  return [
    ...lintCopyField(copy.headline, "headline"),
    ...lintCopyField(copy.supportingCopy, "body"),
    ...lintCopyField(copy.cta, "cta"),
    ...lintCopyField(copy.offer, "offer"),
  ];
}
