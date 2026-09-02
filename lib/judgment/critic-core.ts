// Pure core of the AI Critic (accuracy spec §53-56, §88). No I/O, no server-only, so the guardrails are
// unit-testable. The critic is an ADVERSARIAL reviewer of the deterministic verdict: it can UPHOLD, DOWNGRADE
// confidence, or FLAG for human review - but §55/§56 are law: the AI is NOT a truth source. It can only LOWER
// confidence, never raise it, and it never changes a number. These helpers enforce that in code, so a model
// that tries to over-rule the engine is clamped, not trusted.

export type ConfTier = "high" | "med" | "low";
export type CriticVerdict = "upheld" | "downgrade" | "flag";

const RANK: Record<ConfTier, number> = { high: 2, med: 1, low: 0 };

// Enforce: the critic may only keep or LOWER confidence. A proposed tier above the original is clamped to the
// original (the AI cannot make the engine MORE sure - §56 "AI agreement is not proof").
export function clampConfidence(original: ConfTier, proposed: ConfTier | undefined): ConfTier {
  if (!proposed || !(proposed in RANK)) return original;
  return RANK[proposed] < RANK[original] ? proposed : original;
}

// Normalize a model's verdict string to the allowed set; anything unrecognized is the safe default "flag"
// (a critic that returns garbage should surface for review, not silently uphold).
export function normalizeVerdict(v: string | undefined): CriticVerdict {
  const s = (v ?? "").toLowerCase().trim();
  if (s === "upheld" || s === "downgrade" || s === "flag") return s;
  return "flag";
}

// The final confidence after a critique: a DOWNGRADE/FLAG can lower it (clamped so it never rises); an UPHELD
// leaves it untouched. Never raises. This is the only place the critic touches the engine's confidence.
export function applyCritique(originalConf: ConfTier, verdict: CriticVerdict, proposed: ConfTier | undefined): ConfTier {
  if (verdict === "upheld") return originalConf;
  return clampConfidence(originalConf, proposed ?? "low"); // downgrade/flag: lower toward the proposed tier
}
