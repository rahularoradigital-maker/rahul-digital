import { Tabs } from "@/components/app/tabs";
import { BrandSection } from "@/components/app/market/brand-section";
import { CompetitorsSection } from "@/components/app/market/competitors-section";
import { VoiceSection } from "@/components/app/market/voice-section";
import { PositioningSection } from "@/components/app/market/positioning-section";

// Market: Brand understanding (the context that will drive discovery) + Competitors + Competitor
// Voice, consolidated into one tabbed page.

export const maxDuration = 300; // heavy 90-day day-wise cold pull needs headroom to warm the cache

export default async function MarketPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "brand";

  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-normal tracking-tight">Market</h1>

      <Tabs
        tabs={[
          { key: "brand", label: "Brand" },
          { key: "positioning", label: "ICP & Pillars" },
          { key: "competitors", label: "Competitors" },
          { key: "voice", label: "Competitor Voice" },
        ]}
      />

      {tab === "brand" ? (
        <BrandSection />
      ) : tab === "positioning" ? (
        <PositioningSection />
      ) : tab === "competitors" ? (
        <CompetitorsSection />
      ) : (
        <VoiceSection />
      )}
    </div>
  );
}
