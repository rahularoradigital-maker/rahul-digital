// Bucket the verdict engine's action label into the plain choices a buyer filters by:
// Pause (kill), Refresh, Hold (gather more data), Continue (keep/scale), Fix (non-creative cause).
// Pure + shared by the Fatigue action filter and the Diversity DNA filter, so the grouping is one
// source of truth and never invents an action the engine did not produce.

export type ActionGroup = "pause" | "refresh" | "hold" | "continue" | "fix" | "other";

export function actionGroup(label: string): ActionGroup {
  const l = label.toLowerCase();
  if (/\bkill\b|\bpause\b/.test(l)) return "pause";
  if (/refresh/.test(l)) return "refresh";
  if (/\bfix\b/.test(l)) return "fix";
  if (/hold|watch/.test(l)) return "hold";
  if (/keep|scale|continue/.test(l)) return "continue";
  return "other";
}

export const GROUP_LABEL: Record<ActionGroup, string> = {
  pause: "Pause",
  refresh: "Refresh",
  hold: "Hold",
  continue: "Continue",
  fix: "Fix first",
  other: "Other",
};

// The order the chips appear in (only groups that actually have ads are shown).
export const GROUP_ORDER: ActionGroup[] = ["pause", "refresh", "hold", "continue", "fix", "other"];
