// MARGINAL SCALING engine, the way a media buyer asks it: "if I spend one more rupee,
// what ROAS do I get on it?" Not the average ROAS (that is already spent), but the ROAS
// on the NEXT increment. We read the account's own day-wise spend-vs-return relationship
// and fit the diminishing-returns curve empirically.
//
// The model: revenue ~= k * spend^e  (a constant-elasticity / power law). Taking logs,
//   ln(revenue) = ln(k) + e * ln(spend)
// so the least-squares slope of ln(revenue) on ln(spend) IS the spend elasticity e:
//   e ~= 1  -> constant returns (the next rupee returns like the average one)
//   e  < 1  -> diminishing returns (the next rupee returns LESS than the average)
//   e  > 1  -> increasing returns (headroom; the next rupee returns MORE)
// Under that power law, d(revenue)/d(spend) = e * (revenue/spend), so the marginal ROAS
// is exactly currentRoas * e. That is the first-order estimate we report.
//
// Everything here is MODELLED / INFERENCE from the account's history, never OFFICIAL.
// Pure, no I/O, no deps. calibrate-at-build constants are marked.

export type DayPoint = { spend: number; revenue: number }; // one day

export type MarginalRead = {
  classification: "UNDERFUNDED" | "HEALTHY" | "APPROACHING_SATURATION" | "SATURATED" | "UNKNOWN";
  spendElasticity: number | null; // % change in revenue per % change in spend (log-log slope)
  currentRoas: number | null;
  marginalRoas: number | null; // estimated ROAS on the next spend increment (MODELLED)
  diminishingReturns: boolean;
  confidence: number; // 0-1, lower with fewer days / noisier fit
  label: "MODELLED";
  why: string[];
};

// calibrate-at-build.
const MIN_DAYS = 5; // fewer valid days cannot support an elasticity fit
const DIMINISHING_BELOW = 0.9; // elasticity under this = returns are already bending down
// Classification cut points on the elasticity (headroom -> saturation).
const CUT_UNDERFUNDED = 1.0; // >= 1.0: still scaling linearly or better -> room to spend
const CUT_HEALTHY = 0.8; // 0.8..1.0: mild diminishing, healthy scaling zone
const CUT_APPROACHING = 0.5; // 0.5..0.8: returns bending hard -> approaching saturation; < 0.5 saturated
const CONFIDENCE_DAYS_FULL = 20; // day count at which the "enough data" factor saturates to 1
const CONF_W_DAYS = 0.4; // confidence weight on data volume
const CONF_W_FIT = 0.6; // confidence weight on fit quality (R^2)

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round(v: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export function marginalScaling(days: DayPoint[]): MarginalRead {
  const unknown = (why: string[], confidence: number): MarginalRead => ({
    classification: "UNKNOWN",
    spendElasticity: null,
    currentRoas: null,
    marginalRoas: null,
    diminishingReturns: false,
    confidence: clamp01(confidence),
    label: "MODELLED",
    why,
  });

  // Only days that actually spent AND returned can enter a log-log fit (ln needs > 0).
  const pts = (days ?? []).filter((d) => d && d.spend > 0 && d.revenue > 0 && isFinite(d.spend) && isFinite(d.revenue));
  const n = pts.length;

  if (n < MIN_DAYS) {
    return unknown(
      [
        `Only ${n} day(s) with spend and revenue both > 0; need >= ${MIN_DAYS} to model diminishing returns.`,
        "MODELLED: no elasticity estimated - insufficient day-wise history.",
      ],
      // a touch of confidence for volume even when unknown, capped low
      (n / CONFIDENCE_DAYS_FULL) * 0.3,
    );
  }

  // currentRoas = pooled return per rupee across the window.
  let sumSpend = 0;
  let sumRev = 0;
  for (const d of pts) {
    sumSpend += d.spend;
    sumRev += d.revenue;
  }
  const currentRoas = sumSpend > 0 ? sumRev / sumSpend : null;

  // Least-squares slope of y=ln(rev) on x=ln(spend). slope = cov(x,y)/var(x).
  const xs = pts.map((d) => Math.log(d.spend));
  const ys = pts.map((d) => Math.log(d.revenue));
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }

  // var(ln spend) ~= 0 means every day spent (near) the same amount: no leverage to read
  // how revenue responds to spend. Refuse to fabricate a slope.
  if (sxx <= 1e-9) {
    return unknown(
      [
        `${n} valid days, but spend barely varies day to day (no spread in ln(spend)).`,
        "MODELLED: cannot infer elasticity without variation in daily spend.",
      ],
      0.15,
    );
  }

  const elasticity = sxy / sxx;
  // R^2 of the log-log fit. syy ~= 0 (revenue never moves) -> perfectly explained by construction.
  const rSquared = syy <= 1e-9 ? 1 : clamp01((sxy * sxy) / (sxx * syy));

  const marginalRoas = currentRoas === null ? null : currentRoas * elasticity;
  const diminishingReturns = elasticity < DIMINISHING_BELOW;

  let classification: MarginalRead["classification"];
  let reason: string;
  if (elasticity >= CUT_UNDERFUNDED) {
    classification = "UNDERFUNDED";
    reason = "revenue keeps up with (or outpaces) spend - headroom to scale.";
  } else if (elasticity >= CUT_HEALTHY) {
    classification = "HEALTHY";
    reason = "mild diminishing returns - a healthy scaling zone.";
  } else if (elasticity >= CUT_APPROACHING) {
    classification = "APPROACHING_SATURATION";
    reason = "revenue is bending well below spend - approaching saturation.";
  } else {
    classification = "SATURATED";
    reason = "the next rupee returns far less than the average - saturated.";
  }

  // Confidence rises with day count and with fit quality (R^2). Blend, clamp 0-1.
  const dayFactor = clamp01(n / CONFIDENCE_DAYS_FULL);
  const confidence = clamp01(CONF_W_DAYS * dayFactor + CONF_W_FIT * rSquared);

  const why = [
    `Spend elasticity ~= ${round(elasticity, 2)} (revenue % change per 1% spend change), fit R^2 ${round(rSquared, 2)} over ${n} days.`,
    `Classified ${classification}: ${reason}`,
    currentRoas !== null && marginalRoas !== null
      ? `Current ROAS ${round(currentRoas, 2)}; MODELLED marginal ROAS on the next increment ~= ${round(marginalRoas, 2)}.`
      : "Current ROAS unavailable.",
    n < CONFIDENCE_DAYS_FULL
      ? `INFERENCE caveat: ${n} days is a short window - treat as directional, not OFFICIAL.`
      : "INFERENCE from account history - directional, not an OFFICIAL guarantee.",
  ];

  return {
    classification,
    spendElasticity: round(elasticity, 4),
    currentRoas: currentRoas === null ? null : round(currentRoas, 4),
    marginalRoas: marginalRoas === null ? null : round(marginalRoas, 4),
    diminishingReturns,
    confidence: round(confidence, 4),
    label: "MODELLED",
    why,
  };
}
