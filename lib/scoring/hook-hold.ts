// Hook x Hold 2x2 (creative diagnostic). PURE. The canon's most actionable creative call: a video's HOOK
// (3s-view / impressions - did the thumb stop?) and HOLD (thruplays / 3s-views - did the narrative pay the
// hook off?) place it in one of four quadrants, each with a DIFFERENT fix:
//   high hook / high hold  -> SCALE           (it works; test a budget increase)
//   high hook / low hold   -> REWRITE PAYOFF  (the promise wasn't kept; keep the hook, re-cut the next 5s)
//   low hook / high hold   -> RECUT HOOK      (good asset, bad opener; new first frame - cheapest fix)
//   low hook / low hold    -> KILL CONCEPT    (the angle is dead; don't iterate, kill it)
//
// "High/low" is judged against THIS ACCOUNT's own medians, never a published benchmark (the canon is explicit
// that hook-rate benchmarks are non-comparable across sources; own trailing distribution beats any of them).
// Non-video ads, or ads without enough impressions to trust a rate, return "insufficient" - never a guess.

export type HookHoldQuadrant = "scale" | "rewrite_payoff" | "recut_hook" | "kill_concept" | "insufficient";

export type HookHoldRead = {
  quadrant: HookHoldQuadrant;
  hook: number | null; // 3s / impressions (fraction)
  hold: number | null; // thruplays / 3s (fraction)
  label: string;
  action: string;
  why: string;
};

// Per-ad video counts needed to form the two rates.
export type HookHoldInput = { impressions: number; video3s: number; thruplays: number };

const MIN_IMPRESSIONS = 1000; // a rate below this much delivery isn't stable enough to place in a quadrant

export function hookRate(i: HookHoldInput): number | null {
  return i.impressions > 0 && i.video3s > 0 ? i.video3s / i.impressions : null;
}
export function holdRate(i: HookHoldInput): number | null {
  // hold is only meaningful once the hook fired: thruplays as a share of 3s-views.
  return i.video3s > 0 && i.thruplays > 0 ? i.thruplays / i.video3s : null;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// The account's own median hook and hold, over the video ads that have enough delivery to count. These are
// the high/low split lines for the 2x2 - self-baselined, so the diagnostic travels across accounts.
export function hookHoldMedians(ads: HookHoldInput[]): { hookMedian: number | null; holdMedian: number | null } {
  const eligible = ads.filter((a) => a.impressions >= MIN_IMPRESSIONS && a.video3s > 0);
  const hooks = eligible.map(hookRate).filter((v): v is number => v !== null);
  const holds = eligible.map(holdRate).filter((v): v is number => v !== null);
  return { hookMedian: median(hooks), holdMedian: median(holds) };
}

const QUAD: Record<Exclude<HookHoldQuadrant, "insufficient">, { label: string; action: string; why: string }> = {
  scale: { label: "Scale - it works", action: "Test a budget increase; this creative hooks and holds.", why: "Above the account's median on BOTH hook and hold - the opener stops the thumb and the story pays it off." },
  rewrite_payoff: { label: "Rewrite the payoff", action: "Keep the hook, re-cut the 5s AFTER it - the promise isn't being kept.", why: "Strong hook (above median) but weak hold (below median): people stop, then leave - a congruency failure between the opener and what follows." },
  recut_hook: { label: "Recut the hook", action: "New first frame / opener - the asset is good, the opener isn't. Cheapest fix in creative.", why: "Weak hook (below median) but strong hold (above median): the few who stay watch it through, so the body works - only the opener is losing them." },
  kill_concept: { label: "Kill the concept", action: "Don't iterate on this angle - retire it and test a new concept.", why: "Below the account's median on BOTH hook and hold - the angle isn't landing; execution tweaks won't save it." },
};

// Place one ad in the 2x2 vs the account medians. Returns "insufficient" (never a quadrant) for a non-video
// ad, one below the delivery floor, or when the account has no median to compare against yet.
export function classifyHookHold(input: HookHoldInput, hookMedian: number | null, holdMedian: number | null): HookHoldRead {
  const hook = hookRate(input);
  const hold = holdRate(input);
  if (hook === null || hold === null || input.impressions < MIN_IMPRESSIONS || hookMedian === null || holdMedian === null) {
    return { quadrant: "insufficient", hook, hold, label: "Not enough video signal", action: "Needs a video ad with enough delivery to place it.", why: "No stable hook/hold rate yet, or no account baseline to compare against." };
  }
  const highHook = hook >= hookMedian;
  const highHold = hold >= holdMedian;
  const q: Exclude<HookHoldQuadrant, "insufficient"> = highHook && highHold ? "scale" : highHook && !highHold ? "rewrite_payoff" : !highHook && highHold ? "recut_hook" : "kill_concept";
  return { quadrant: q, hook, hold, ...QUAD[q] };
}
