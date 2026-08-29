// Evidence tags (Yamin canon doctrine rule 5: "every number carries an evidence tag").
// The pure, JSX-free registry that both the EvidenceTag chip and its runnable check read,
// so the meaning shown on screen can never drift from the canon. Source of the four tiers:
// docs/engineering/yamin-measurement-canon.spec.json -> evidence_tags.
//
// A/B/C are transcribed verbatim. Y is phrased to keep the canon's honesty rule explicit:
// a judgement number must never masquerade as a platform fact.

export type EvidenceTier = "A" | "B" | "C" | "Y";

export const EVIDENCE_MEANING: Record<EvidenceTier, { name: string; meaning: string }> = {
  A: { name: "Platform", meaning: "Platform published or a real dataset. Build on it." },
  B: { name: "Panel", meaning: "Named panel, self-selected sample. Starting line only." },
  C: { name: "Folklore", meaning: "Unsourced folklore. Never build on it, never quote it." },
  Y: { name: "Yamin", meaning: "Our own judgement, no public benchmark. Corrected from outcomes over time, not a platform fact." },
};

// The screen-reader label for a chip: tier + name + full meaning, so the provenance is
// spoken, not just colour-coded.
export function evidenceAria(tier: EvidenceTier): string {
  const e = EVIDENCE_MEANING[tier];
  return `Evidence ${tier}, ${e.name}: ${e.meaning}`;
}
