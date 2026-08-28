import { notFound } from "next/navigation";
import { analyzeAccount, type CockpitAdInput } from "@/lib/cockpit/analyze";
import { SAMPLE_ADS } from "@/lib/sample/account";
import { ActionList } from "@/components/cockpit/ActionList";
import { Leaderboard } from "@/components/cockpit/Leaderboard";
import { rupees } from "@/lib/format";

// DEV-ONLY visual preview of the cockpit components with sample data (no auth needed), so the
// redesign, the per-verdict "why" lines, and the "Show more" collapse can be eyeballed without
// logging into the real /app. Returns 404 in production so it is never shipped to users.
export default function PreviewCockpit() {
  if (process.env.NODE_ENV === "production") notFound();

  // Pad the 5-ad sample to 14 (distinct ids) so the long-list collapse actually triggers and the
  // "wall of identical rows" this addresses is reproduced.
  const padded: CockpitAdInput[] = Array.from({ length: 14 }, (_, i) => {
    const base = SAMPLE_ADS[i % SAMPLE_ADS.length];
    return { ...base, id: `${base.id}_${i}`, name: `${base.name} ${i + 1}` };
  });
  const view = analyzeAccount(padded, "SAMPLE");
  const date = "2026-08-14_2026-08-28";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <div className="text-[13px] text-[var(--ink-muted)]">Dev preview · sample data</div>
        <h1 className="mt-1 text-[26px] font-normal tracking-tight">Cockpit components</h1>
      </div>
      <ActionList items={view.doThis} ads={view.leaderboard} accountId="act_0" dateParam={date} />
      <Leaderboard ads={view.leaderboard} rupees={rupees} accountId="act_0" dateParam={date} />
    </div>
  );
}
