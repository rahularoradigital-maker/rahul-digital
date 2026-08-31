// Content Quality Gate (spec sections 18, 44, 45). Every AI-written reply or article is checked BEFORE it
// reaches your queue - a CRITICAL flag blocks it (never queued), a WARN flags it for your eye. This is what
// lets Scout draft autonomously without risking the brand: no fabricated results, no unsupported claims, no
// undisclosed promotion, no AI-cliche hype. Pure - unit-testable (scripts/check-quality.ts).

export type QualityFlag = { code: string; severity: "critical" | "warn"; detail: string };
export type QualityResult = { pass: boolean; flags: QualityFlag[] };

// AI-cliche / hype words to avoid (section 44). Warn - they cheapen the "shows its work" voice.
const HYPE = /\b(unleash|game[- ]?chang(er|ing)|revolutioni[sz]e|revolutionary|seamless(ly)?|next[- ]?gen|supercharge|cutting[- ]?edge|synerg|leverage the power|elevate your|delve|tapestry)\b/i;
// Unsupported absolute claims (section 45) - CRITICAL, they are claims we cannot defend.
const UNSUPPORTED = /\b(guarantee(d|s)?|#\s?1\b|the best\b|always works|never fails?|proven to (double|triple|10x)|instant(ly)? results?|risk[- ]free)\b/i;
// A specific performance number stated as fact - WARN (Scout must not invent stats; a real one needs a source).
const HARD_STAT = /\b\d{1,3}(\.\d+)?\s?%|\b\d+(\.\d+)?x\b|[₹$]\s?\d{3,}/;
// Disclosure phrases that must accompany an AdBrain mention.
const DISCLOSURE = /(i work on|i(?:'m| am) (?:on|with|from)|full disclosure|disclosure:|team behind|i help build)/i;
const MENTIONS_ADBRAIN = /\badbrain\b|adscaledigital\.co/i;
// Salesy signals - WARN (community replies must be useful-first).
const SALESY = /\b(check (?:it|us|this) out|sign up (?:now|today)|click (?:here|the link)|dm me|link in bio)\b/i;

export function checkContent(text: string, opts: { mayMention: boolean } = { mayMention: false }): QualityResult {
  const flags: QualityFlag[] = [];
  const t = text ?? "";

  if (UNSUPPORTED.test(t)) flags.push({ code: "unsupported_claim", severity: "critical", detail: "contains an absolute/guarantee claim we cannot defend" });

  const mentions = MENTIONS_ADBRAIN.test(t);
  if (mentions && !DISCLOSURE.test(t)) flags.push({ code: "undisclosed_mention", severity: "critical", detail: "mentions AdBrain without disclosing affiliation" });
  if (mentions && !opts.mayMention) flags.push({ code: "mention_not_allowed", severity: "critical", detail: "mentions AdBrain where the community/context does not permit it" });

  if (HARD_STAT.test(t)) flags.push({ code: "unsourced_stat", severity: "warn", detail: "states a specific number/stat - verify it is real + sourced, not invented" });
  if (HYPE.test(t)) flags.push({ code: "hype", severity: "warn", detail: "uses AI-cliche/hype wording - off the 'shows its work' voice" });
  if (SALESY.test(t)) flags.push({ code: "salesy", severity: "warn", detail: "reads salesy - a community reply should be useful-first" });

  return { pass: !flags.some((f) => f.severity === "critical"), flags };
}
