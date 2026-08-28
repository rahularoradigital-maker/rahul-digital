import { GenerateInsight } from "./generate-insight";

// Brand Brain: a grounded read of what wins for this brand, written from the account's REAL ads
// (names + performance) by Gemini. No fabricated hooks/angles - see /api/creative/analyze.
export function BrandBrainSection({ initialContent }: { initialContent: string | null }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[13px] text-[var(--ink-muted)]">Brand Brain</div>
        <h1 className="mt-1.5 text-[26px] font-normal tracking-tight">What wins for your brand.</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--ink-muted)]">
          A read of your live ads: what you sell, the angles, formats and offers that win, what is fading, and your
          positioning. Built from your real ad names and performance, not invented.
        </p>
      </div>
      <GenerateInsight type="brand" initial={initialContent} emptyCta="Generate Brand Brain" />
    </div>
  );
}
