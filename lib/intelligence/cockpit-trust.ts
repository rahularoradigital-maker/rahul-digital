// Live trust read from CockpitData alone (charter §8-12, §55, §130): how much should a user trust what they
// are looking at RIGHT NOW, computed from the account's own real signals - data completeness, whether the
// headline is complete, and how fresh the data is. Non-latent: every input is already on CockpitData, so this
// runs on real data with no external dependency. Honest by construction: insufficient or stale data caps the
// read down, never up (a pretty dashboard on thin data is not trustworthy).

import type { CockpitData } from "@/lib/app/cockpit-data";
import type { TrustTier } from "./system-trust.ts";

export type CockpitTrust = {
  tier: TrustTier; // trusted | watch | shaky
  completeness: number | null; // 0..1 share of expected days present
  stale: boolean; // data is old / headline incomplete
  reasons: string[];
};

const GOOD_COMPLETENESS = 0.85; // below this, the window has real gaps

export function cockpitTrust(data: CockpitData): CockpitTrust {
  if (!data.connected) {
    return { tier: "shaky", completeness: null, stale: false, reasons: ["No account connected - nothing to trust yet."] };
  }
  const dq = data.dataQuality as { status?: string; trustworthy?: boolean; completeness?: number } | undefined;
  const stale = !!data.stale || !!data.headlineIncomplete;
  const completeness = typeof dq?.completeness === "number" ? dq.completeness : null;
  const reasons: string[] = [];

  // The two hard caps: data the quality engine itself won't vouch for, or a knowingly-incomplete headline.
  const dataUntrusted = dq?.status === "insufficient_data" || dq?.trustworthy === false;
  if (dq?.status === "insufficient_data") reasons.push("Not enough data yet to judge this account.");
  else if (dq?.trustworthy === false) reasons.push("The data-quality engine flags this window as not trustworthy.");
  if (data.headlineIncomplete) reasons.push("The headline numbers are still assembling (incomplete).");
  if (data.stale) reasons.push("Data is stale - the last sync is old.");
  if (completeness != null && completeness < GOOD_COMPLETENESS) reasons.push(`Only ${Math.round(completeness * 100)}% of the expected days are present.`);
  if (reasons.length === 0) reasons.push("Data is complete, fresh, and vouched for - trust the numbers.");

  let tier: TrustTier;
  if (dataUntrusted) tier = "shaky";
  else if (stale || (completeness != null && completeness < GOOD_COMPLETENESS)) tier = "watch";
  else tier = "trusted";

  return { tier, completeness, stale, reasons };
}
