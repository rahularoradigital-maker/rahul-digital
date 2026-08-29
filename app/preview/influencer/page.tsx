import { notFound } from "next/navigation";
import { InfluencerHunt } from "@/components/app/influencer/influencer-hunt";

// DEV-ONLY visual preview of Influencer Hunt with sample data (no auth needed), so the ranked cards,
// transparent score breakdown, and evidence/confidence badges can be eyeballed without logging into /app.
// Returns 404 in production so it is never shipped to users. The real page lives at /app/influencer.
export default function PreviewInfluencer() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div>
        <div className="text-[13px] text-[var(--ink-muted)]">Dev preview · sample data</div>
        <h1 className="mt-1 text-[26px] font-normal tracking-tight">Influencer Hunt</h1>
      </div>
      <InfluencerHunt />
    </div>
  );
}
