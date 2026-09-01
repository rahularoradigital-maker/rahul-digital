import { ConnectState } from "@/components/app/connect-state";
import type { CockpitData } from "@/lib/app/cockpit-data";
import { FatigueList } from "@/components/app/creative/fatigue-list";

// Creative Fatigue (Rulebook 5.1). The fatigue READ for every ad comes straight off
// the verdict engine's real output (winner/refresh/do_not_kill_yet/loser -> Healthy/
// Fatiguing/Watch/Fatigued, see FATIGUE_STATE) - never a re-derived number. The list
// (FatigueList) is a client component so the buyer can filter to just one action
// (Pause / Refresh / Hold / Continue) without a re-fetch.
//
// HONEST GATE: a precise fatigue percentage and a half-life "death date" (5.1) need
// per-ad delivery history (impressions/day, frequency) the current CockpitView does
// not expose. So no timed forecast, date, or percentage is fabricated here - every
// row says plainly that it needs more delivery history.

export function FatigueSection({ data, days }: { data: CockpitData; days: number }) {
  if (!data.connected) {
    return <ConnectState reason={data.reason} errorNote={data.errorNote} accountName={data.accountName} days={data.days} />;
  }

  return <FatigueList ads={data.view.leaderboard} accountName={data.accountName} accountId={data.accountId} dateParam={data.dateParam} days={days} />;
}
