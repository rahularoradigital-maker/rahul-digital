import { Tabs } from "@/components/app/tabs";
import { CompetitorsSection } from "@/components/app/market/competitors-section";
import { VoiceSection } from "@/components/app/market/voice-section";

// Market: Competitors + Voice of Customer, consolidated into one tabbed page.
// Both are honest gates (no account data needed), so no loadCockpit here.

export default async function MarketPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "competitors";

  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-semibold tracking-tight">Market</h1>

      <Tabs
        tabs={[
          { key: "competitors", label: "Competitors" },
          { key: "voice", label: "Voice of Customer" },
        ]}
      />

      {tab === "competitors" ? <CompetitorsSection /> : <VoiceSection />}
    </div>
  );
}
