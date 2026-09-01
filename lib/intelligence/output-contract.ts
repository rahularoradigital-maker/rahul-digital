// The unified intelligence Output Contract (Master Charter §110/§120/§160, and the #1 Build Loop rule #3 -
// the reasoning chain). Every DECISION-GRADE output the product gives a user (a fatigue call, a bleed number,
// a scale/kill recommendation) is assembled through this one typed object so it can never skip the reasoning:
//
//   DATA -> TRUST -> SIGNAL -> DIAGNOSIS -> ECONOMIC IMPACT -> 2nd ORDER -> 3rd ORDER -> DECISION -> ACTION -> OUTCOME -> LEARNING
//
// The load-bearing law (charter §5, §98, rule #3): NEVER jump DATA -> DECISION. If the data cannot be trusted
// (too little spend/volume, stale, conflicting sources), the output HOLDs and says what to connect/wait for -
// it does not invent a decision. This module is PURE + deterministic (no server-only, no I/O, no Date) so it
// runs in the check gate and anywhere; the CALLER stamps timestamps and supplies the real, sourced numbers.
// A raw metric tile does NOT need this - only outputs that recommend or conclude something.

export type EvidenceTier = "VERIFIED" | "PROVIDER" | "CALCULATED" | "INFERENCE" | "UNKNOWN";
export type Confidence = "high" | "med" | "low";
export type EntityLevel = "account" | "campaign" | "adset" | "ad";

export interface OutputContract {
  // identity + provenance
  id: string;
  kind: string; // "fatigue" | "bleed" | "funnel" | "scale" | ...
  entity?: { level: EntityLevel; id?: string; name?: string };
  generatedAt?: string; // caller-stamped (Date is not available in pure/check contexts)
  dataAsOf?: string; // data freshness, caller-supplied

  // --- the 11-stage reasoning chain ---
  data: { summary: string; source: string }; // 1 DATA (real, attributed)
  trust: { ok: boolean; tier: EvidenceTier; reason: string }; // 2 TRUST (the gate)
  signal?: string; // 3 SIGNAL (sustained, not a blip)
  diagnosis?: string; // 4 DIAGNOSIS (cause, not symptom)
  economicImpactRs?: number | null; // 5 ECONOMIC IMPACT (money at stake, ₹)
  secondOrder?: string; // 6 what the obvious action causes next
  thirdOrder?: string; // 7 the downstream of that
  decision?: { call: string; why: string } | null; // 8 DECISION (the call + reason)
  action?: string | null; // 9 ACTION (concrete, reversible; a DRAFT when it touches the outside world)
  outcome?: string | null; // 10 OUTCOME (measured after action)
  learning?: string | null; // 11 LEARNING (fed forward)

  // --- §120 output standard (always answerable) ---
  confidence: Confidence;
  whatCouldBeWrong: string; // §110/§120: mandatory - the honest failure mode
  sampleNote?: string; // sample size / sufficiency, when relevant
}

// HOLD: the data cannot be trusted enough to decide. No decision/action is produced - the honest refusal
// (charter §5 "comfortable saying HOLD", rule #3 "if TRUST fails, refuse to decide and say what to connect").
export function hold(input: {
  id: string;
  kind: string;
  entity?: OutputContract["entity"];
  data: OutputContract["data"];
  tier?: EvidenceTier;
  reason: string; // why it can't be trusted (e.g. "3 conversions, need >=50")
  whatToDo: string; // what to connect / wait for
  confidence?: Confidence;
}): OutputContract {
  return {
    id: input.id,
    kind: input.kind,
    entity: input.entity,
    data: input.data,
    trust: { ok: false, tier: input.tier ?? "UNKNOWN", reason: input.reason },
    decision: null,
    action: null,
    outcome: null,
    learning: null,
    confidence: input.confidence ?? "low",
    whatCouldBeWrong: input.whatToDo,
  };
}

// DECIDE: the data is trusted; assemble a full decided output. Enforces the chain prerequisites so a decision
// can never ship without its reasoning (§91 no recommendation without economic context; §120 what-could-be-wrong;
// rule #3 always state ₹ impact + 2nd-order before a DECISION). Throws on a contract that violates the law -
// caught by the check gate, so a bad output fails in tests, not in front of a media buyer.
export function decide(input: {
  id: string;
  kind: string;
  entity?: OutputContract["entity"];
  data: OutputContract["data"];
  tier: EvidenceTier;
  trustReason: string;
  signal: string;
  diagnosis: string;
  economicImpactRs: number; // required for a decision (§91)
  secondOrder: string; // required before a decision (rule #3)
  thirdOrder?: string;
  decision: { call: string; why: string };
  action: string;
  whatCouldBeWrong: string; // required (§120)
  confidence: Confidence;
  sampleNote?: string;
  generatedAt?: string;
  dataAsOf?: string;
}): OutputContract {
  const c: OutputContract = {
    id: input.id,
    kind: input.kind,
    entity: input.entity,
    generatedAt: input.generatedAt,
    dataAsOf: input.dataAsOf,
    data: input.data,
    trust: { ok: true, tier: input.tier, reason: input.trustReason },
    signal: input.signal,
    diagnosis: input.diagnosis,
    economicImpactRs: input.economicImpactRs,
    secondOrder: input.secondOrder,
    thirdOrder: input.thirdOrder,
    decision: input.decision,
    action: input.action,
    outcome: null,
    learning: null,
    confidence: input.confidence,
    whatCouldBeWrong: input.whatCouldBeWrong,
    sampleNote: input.sampleNote,
  };
  const v = validateOutput(c);
  if (!v.ok) throw new Error("OutputContract invalid: " + v.problems.join("; "));
  return c;
}

// Deterministic invariant check. Returns every violation (empty = valid). Used by decide() and the gate.
export function validateOutput(c: OutputContract): { ok: boolean; problems: string[] } {
  const p: string[] = [];
  if (!c.id) p.push("missing id");
  if (!c.kind) p.push("missing kind");
  if (!c.data?.summary || !c.data?.source) p.push("DATA stage incomplete (summary+source)");
  if (!c.whatCouldBeWrong) p.push("missing whatCouldBeWrong (§120)");

  const decided = !!c.decision;
  if (!c.trust?.ok && decided) p.push("LAW: a DECISION was made while TRUST failed (never jump DATA->DECISION)");
  if (decided) {
    // A trusted decision must carry its reasoning chain (rule #3 / §91).
    if (c.economicImpactRs === undefined || c.economicImpactRs === null)
      p.push("DECISION without economic impact (₹) (§91)");
    if (!c.secondOrder) p.push("DECISION without a second-order effect (rule #3)");
    if (!c.diagnosis) p.push("DECISION without a DIAGNOSIS (cause, not symptom)");
    if (!c.decision!.why) p.push("DECISION without a reason");
  }
  if (!c.trust?.ok && (c.action || c.outcome)) p.push("untrusted output must not carry an action/outcome");
  return { ok: p.length === 0, problems: p };
}

// One-line plain-English headline for a card (§121: translate, don't dump z-scores). HOLD says so honestly.
export function headline(c: OutputContract): string {
  if (!c.trust.ok) return `HOLD - ${c.trust.reason}. ${c.whatCouldBeWrong}`;
  const rs = c.economicImpactRs != null ? ` (₹${Math.round(c.economicImpactRs).toLocaleString("en-IN")} at stake)` : "";
  return `${c.decision?.call ?? "Review"}${rs} - ${c.decision?.why ?? c.diagnosis ?? c.signal ?? ""}`.trim();
}
