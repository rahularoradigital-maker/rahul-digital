// Causality-ladder diagnostic engine (buyer-judgment-rules.md J3 + J4).
// When a metric drops, diagnose the cause in a FIXED ORDER and never jump to
// blaming creative. Pure functions, no I/O, no deps: a caller supplies the
// discriminating signals it has measured, this returns the first cause that
// fires plus what was ruled out along the way. Mirrors lib/decision.ts style:
// fail readable, never throw, never fabricate a cause the signals do not support.

export type Severity = "green" | "amber" | "red" | "black";

// J3: the order is the rule. Measurement is ALWAYS first (J4 gate: a confident
// wrong number is worse than no number), creative_fatigue is ALWAYS last (never
// blame the creative until every cheaper, more-likely cause is ruled out).
// change_volatility (J8: rule the humans out — a burst of manual edits triggers
// a learning reset) sits just above creative_fatigue, the last non-creative rung.
export const CAUSE_LADDER = [
  "measurement", // 0  J4 gate: sales not reaching the platform
  "tracking_attribution", // 1  attribution window / pixel / CAPI shift
  "auction_cpm", // 2  the auction got more expensive (often expected/seasonal)
  "landing_checkout", // 3  a funnel step broke (LP, checkout)
  "stock_out", // 4  the product went out of stock
  "audience_saturation", // 5  the audience is used up (gated, see diagnose)
  "change_volatility", // 6  J8: too many human edits, then a drop (learning reset)
  "creative_fatigue", // 7  LAST: only after all of the above are ruled out
] as const;

// One discriminating check per rung, all optional — a caller supplies only what
// it has. `moveSizePct` is the size of the metric move (percent); severity is
// graded by CAUSE, not by this number, so it never decides the cause.
export type DiagnosticSignals = {
  measurementBroken?: boolean; // J4 gate: sales not reaching the platform
  trackingShifted?: boolean; // attribution/pixel/CAPI changed
  cpmSpiked?: boolean; // auction got more expensive
  funnelStepBroke?: boolean; // landing page / checkout step broke
  outOfStock?: boolean; // product out of stock
  frequencyHigh?: boolean; // exposure is high (saturation OR fatigue signal)
  freshCreativeRecovers?: boolean; // discriminator: a fresh creative recovers the metric?
  //   false + high freq + healthy supply/sameness => audience used up (saturation)
  //   true  + high freq                            => the creative was worn out (fatigue)
  manyChangesThenDrop?: boolean; // J8: >= 4 manual changes in a day, then a drop
  creativeSupplyHealthy?: boolean; // J3 saturation suppression gate
  samenessHealthy?: boolean; // J3 saturation suppression gate
  moveSizePct: number; // size of the metric move; grades severity, never the cause
};

export type DiagnoseResult =
  | {
      status: "ok";
      cause: string;
      rung: number;
      severity: Severity;
      ruledOut: string[];
      note: string;
    }
  | { status: "suppressed"; reason: string }
  | { status: "insufficient_data" };

/**
 * Does the discriminating check for `cause` fire on these signals? One check per
 * rung. `measurement` is handled by the J4 gate before the walk, so inside the
 * walk it is always false (measurement is always ruled out on any ok result).
 */
function fires(cause: string, s: DiagnosticSignals): boolean {
  switch (cause) {
    case "measurement":
      return s.measurementBroken === true;
    case "tracking_attribution":
      return s.trackingShifted === true;
    case "auction_cpm":
      return s.cpmSpiked === true;
    case "landing_checkout":
      return s.funnelStepBroke === true;
    case "stock_out":
      return s.outOfStock === true;
    // saturation vs fatigue: high frequency AND a fresh creative does NOT recover
    // the metric => the audience is used up, not the creative.
    case "audience_saturation":
      return s.frequencyHigh === true && s.freshCreativeRecovers === false;
    case "change_volatility":
      return s.manyChangesThenDrop === true;
    // creative fatigue is the catch-all LAST rung: high frequency with saturation
    // either not indicated (a fresh creative recovers) or ruled out by the J3
    // suppression gate below. Reached only after everything cheaper is ruled out.
    case "creative_fatigue":
      return s.frequencyHigh === true;
    default:
      return false;
  }
}

const NOTES: Record<string, string> = {
  measurement: "sales are not reaching the platform — fix measurement before trusting any number",
  tracking_attribution: "attribution/pixel/CAPI shifted — the numbers moved, the ads may not have",
  auction_cpm: "the auction got more expensive — often expected (season/festival), not a creative problem",
  landing_checkout: "a funnel step (landing page or checkout) broke — spend is arriving, conversion is leaking",
  stock_out: "the product went out of stock — demand is fine, supply is not",
  audience_saturation:
    "high frequency and a fresh creative does not recover the metric, with healthy creative supply and low sameness — the audience is used up",
  change_volatility: "many manual changes then a drop — a learning reset from human edits, freeze-and-relearn",
  creative_fatigue: "high frequency with every cheaper cause ruled out — the creative itself is worn out",
};

function noteFor(cause: string): string {
  return NOTES[cause] ?? cause;
}

/** Size band used only for causes whose severity legitimately scales with size. */
function sizeBand(moveSizePct: number): Severity {
  const m = Math.abs(moveSizePct);
  if (m < 10) return "green";
  if (m < 25) return "amber";
  return "red";
}

/**
 * Severity graded by CAUSE, not by size (J3). Calibrate-at-build bands — owner
 * anchors, editable:
 *  - measurement           -> black  ALWAYS: a broken pixel is an emergency at any size (J4).
 *  - tracking_attribution  -> red    ALWAYS: the numbers are corrupt regardless of the move.
 *  - auction_cpm           -> green/amber: benign, often expected; a big move here is not auto-red.
 *  - landing/stock/saturation/change -> at least amber, escalating to red with size.
 *  - creative_fatigue      -> graded purely by size (the benign, expected, last-resort cause).
 */
export function severityForCause(cause: string, moveSizePct: number): Severity {
  switch (cause) {
    case "measurement":
      return "black";
    case "tracking_attribution":
      return "red";
    case "auction_cpm":
      return Math.abs(moveSizePct) <= 30 ? "green" : "amber"; // a 30% festival CPM drop is green (J3)
    case "landing_checkout":
    case "stock_out":
    case "audience_saturation":
    case "change_volatility": {
      const b = sizeBand(moveSizePct);
      return b === "green" ? "amber" : b; // real problems are at least amber
    }
    case "creative_fatigue":
      return sizeBand(moveSizePct);
    default:
      return "amber";
  }
}

/**
 * Walk the causality ladder in fixed order and return the FIRST cause that
 * fires, with the rungs passed over listed in `ruledOut`.
 *  - J4 FIRST: measurementBroken suppresses the whole board.
 *  - J3 suppression: audience_saturation may NOT be reported unless both
 *    creativeSupplyHealthy AND samenessHealthy are true; otherwise it is skipped
 *    (added to ruledOut) and the walk continues down toward creative_fatigue.
 *  - nothing fires and nothing to decide on -> insufficient_data.
 */
export function diagnose(signals: DiagnosticSignals): DiagnoseResult {
  // J4 gate: a confident wrong number is worse than no number.
  if (signals == null || typeof signals !== "object") {
    return { status: "insufficient_data" };
  }
  if (signals.measurementBroken === true) {
    return { status: "suppressed", reason: "fix measurement first" };
  }

  const ruledOut: string[] = [];
  for (let i = 0; i < CAUSE_LADDER.length; i++) {
    const cause = CAUSE_LADDER[i];
    if (!fires(cause, signals)) {
      ruledOut.push(cause);
      continue;
    }
    // J3 suppression: never report "audience used up" without both health checks.
    if (
      cause === "audience_saturation" &&
      !(signals.creativeSupplyHealthy === true && signals.samenessHealthy === true)
    ) {
      ruledOut.push(cause); // skipped, keep walking toward creative_fatigue
      continue;
    }
    return {
      status: "ok",
      cause,
      rung: i,
      severity: severityForCause(cause, signals.moveSizePct ?? 0),
      ruledOut,
      note: noteFor(cause),
    };
  }
  return { status: "insufficient_data" };
}
