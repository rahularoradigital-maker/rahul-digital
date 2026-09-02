// The AI Critic, applied to the Output Contract layer (accuracy spec §53-56). This is the DETERMINISTIC,
// always-on half: it enforces §56 - a decision may never be MORE confident than its evidence tier supports -
// and can only LOWER confidence, never raise it (critic-core clamps this). The AI critic (lib/judgment/critic.ts)
// is the escalation for the ambiguous cases; this catches the obvious over-confident calls with zero AI cost.
// Pure, no I/O. Reuses the judgment critic's clamp so both halves obey the same law.

import { applyCritique, type ConfTier, type CriticVerdict } from "../judgment/critic-core.ts";
import type { OutputContract, EvidenceTier, Confidence } from "./output-contract.ts";

// The most confidence an evidence tier can honestly support (§56: agreement/inference is not proof).
const TIER_CAP: Record<EvidenceTier, ConfTier> = {
  VERIFIED: "high",
  PROVIDER: "high",
  CALCULATED: "high",
  INFERENCE: "med", // a modelled/inferred number can't justify "high"
  UNKNOWN: "low",
};
const RANK: Record<ConfTier, number> = { high: 2, med: 1, low: 0 };

export type ContractCritique = {
  verdict: CriticVerdict; // upheld | downgrade | flag
  originalConfidence: Confidence;
  finalConfidence: Confidence; // never above original
  flags: string[];
  note: string;
};

// Review one contract's decision. A HOLD or a decision-less contract is upheld unchanged (nothing to over-
// claim). A decided contract whose confidence exceeds its evidence-tier cap is DOWNGRADED to the cap.
export function reviewContract(c: OutputContract): ContractCritique {
  const orig = c.confidence as ConfTier;
  if (!c.decision || !c.trust.ok) {
    return { verdict: "upheld", originalConfidence: c.confidence, finalConfidence: c.confidence, flags: [], note: "No decision to critique." };
  }
  const flags: string[] = [];
  const cap = TIER_CAP[c.trust.tier];
  if (RANK[orig] > RANK[cap]) flags.push(`confidence "${orig}" exceeds what ${c.trust.tier.toLowerCase()} evidence supports (max "${cap}")`);
  // A decision that names a plausible alternative in whatCouldBeWrong but still claims "high" is worth a flag.
  if (orig === "high" && /if |unless |may be|could be/i.test(c.whatCouldBeWrong)) flags.push("a live alternative explanation exists, so 'high' is optimistic");

  const verdict: CriticVerdict = flags.length === 0 ? "upheld" : flags.some((f) => f.includes("exceeds what")) ? "downgrade" : "flag";
  // Downgrade toward the tier cap; a bare flag nudges one tier down. Never raises (critic-core enforces).
  const proposed: ConfTier = verdict === "downgrade" ? cap : orig === "high" ? "med" : "low";
  const finalConfidence = applyCritique(orig, verdict, proposed) as Confidence;
  const note =
    verdict === "upheld"
      ? "Upheld: confidence is consistent with the evidence."
      : `${verdict === "downgrade" ? "Downgraded" : "Flagged"}: ${flags.join("; ")}.`;
  return { verdict, originalConfidence: c.confidence, finalConfidence, flags, note };
}

// Apply the critique to the contract, returning a copy with the (never-raised) confidence + a critic note in
// whatCouldBeWrong so the human sees why. Deterministic; safe to run on every decision.
export function critiqued(c: OutputContract): OutputContract {
  const r = reviewContract(c);
  if (r.verdict === "upheld") return c;
  return { ...c, confidence: r.finalConfidence, whatCouldBeWrong: `${c.whatCouldBeWrong} [critic: ${r.note}]` };
}
