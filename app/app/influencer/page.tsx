import { InfluencerHunt } from "@/components/app/influencer/influencer-hunt";

// Influencer Hunt: brand-matched creator discovery + transparent, formula-driven ranking. Currently runs in
// preview mode on sample data (clearly labelled) so the UX is live; a connected creator-data provider swaps
// in real creators with no UI change.

export default function InfluencerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight">Influencer Hunt</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">
          Find the creators most likely to be strategically valuable for this brand - ranked by a transparent formula, with
          evidence and confidence on every field, and an honest &ldquo;why this creator&rdquo; behind each rank.
        </p>
      </div>
      <InfluencerHunt />
    </div>
  );
}
