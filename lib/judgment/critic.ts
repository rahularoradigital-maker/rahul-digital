import "server-only";
import { runTaskJson } from "../ai/router.ts";
import { compose } from "../ai/compose.ts";
import { applyCritique, normalizeVerdict, type ConfTier, type CriticVerdict } from "./critic-core.ts";
import type { Judgment } from "./engine.ts";

export type { ConfTier, CriticVerdict } from "./critic-core.ts";

// The AI Critic (accuracy spec §53-56, §88). After the DETERMINISTIC judgment engine produces a verdict, this
// asks an AI to try to DISPROVE it - name the strongest alternative explanation, the missing evidence, and
// what would falsify it. It NEVER recalculates or changes a number (§55); it may only DOWNGRADE confidence or
// FLAG for human review (§56). Best-effort: returns null when no AI is configured, so the deterministic verdict
// stands unchanged (the engine is authoritative; the critic is an adversarial reviewer, not a truth source).

export type Critique = {
  verdict: CriticVerdict; // upheld | downgrade | flag
  alternative: string; // strongest alternative explanation
  missingEvidence: string;
  wouldFalsify: string; // the observation that would prove the diagnosis wrong (§54)
  reasoning: string;
  originalConfidence: ConfTier;
  finalConfidence: ConfTier; // <= original, always (enforced in code)
};

export async function critique(j: Judgment, context = ""): Promise<Critique | null> {
  const system =
    `You are a $100M/month media buyer acting as an ADVERSARIAL reviewer. A deterministic engine produced the ` +
    `verdict below. Try to DISPROVE it. Do NOT recalculate or change any number - challenge only the ` +
    `INTERPRETATION. Name the single strongest ALTERNATIVE explanation (e.g. audience saturation, auction-cost ` +
    `rise, tracking/attribution issue, offer or landing-page change, seasonality, a budget shift - not creative ` +
    `fatigue), the MISSING evidence, and the observation that would FALSIFY the diagnosis. Then decide: ` +
    `"upheld" (evidence holds), "downgrade" (confidence should be lower), or "flag" (a serious alternative needs ` +
    `human review). You may only LOWER confidence, never raise it. Would a $100M/mo buyer act on this evidence? ` +
    `If not, downgrade or flag. Return JSON {verdict, alternative, missingEvidence, wouldFalsify, reasoning, ` +
    `proposedConfidence}.`;
  const pkg =
    `Verdict: ${j.verdict} (confidence ${j.confidence.tier}, agreement ${j.agreement.agree}/${j.agreement.of}, lean ${j.agreement.lean}).\n` +
    `Headline: ${j.headline}\n` +
    `Evidence gates: ${j.evidence.gates.map((g) => `${g.name}:${g.passed ? "ok" : "FAIL(" + g.detail + ")"}`).join(", ")}\n` +
    `Signals: ${j.agreement.signals.map((s) => `${s.name}=${s.dir} (${s.note})`).join("; ")}\n` +
    (context ? `Context: ${context}` : "");

  const out = await runTaskJson("decision-verdict", compose(system, [{ label: "verdict_and_evidence", content: pkg }]), {
    verdict: "one of: upheld | downgrade | flag",
    alternative: "string - the strongest alternative explanation",
    missingEvidence: "string",
    wouldFalsify: "string - the observation that would prove the diagnosis wrong",
    reasoning: "string",
    proposedConfidence: "one of: high | med | low",
  });
  if (!out) return null;

  const verdict = normalizeVerdict(String(out.verdict ?? ""));
  const proposed = ["high", "med", "low"].includes(String(out.proposedConfidence)) ? (out.proposedConfidence as ConfTier) : undefined;
  const finalConfidence = applyCritique(j.confidence.tier, verdict, proposed); // never raises - enforced in code

  return {
    verdict,
    alternative: String(out.alternative ?? "").trim(),
    missingEvidence: String(out.missingEvidence ?? "").trim(),
    wouldFalsify: String(out.wouldFalsify ?? "").trim(),
    reasoning: String(out.reasoning ?? "").trim(),
    originalConfidence: j.confidence.tier,
    finalConfidence,
  };
}
