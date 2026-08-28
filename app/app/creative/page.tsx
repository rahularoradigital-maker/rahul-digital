import { loadCockpit, parseDays } from "@/lib/app/cockpit-data";
import { Tabs } from "@/components/app/tabs";
import { FatigueSection } from "@/components/app/creative/fatigue-section";
import { DiversitySection } from "@/components/app/creative/diversity-section";
import { BrandBrainSection } from "@/components/app/creative/brand-brain-section";
import { ConceptsSection } from "@/components/app/creative/concepts-section";

// Creative: one consolidated page for the four creative screens (Fatigue, Diversity,
// Brand Brain, Concepts). loadCockpit runs exactly once here; each tab section is a
// pure render over the same CockpitData, so switching tabs never re-fetches.

const TABS = [
  { key: "fatigue", label: "Fatigue" },
  { key: "diversity", label: "Diversity" },
  { key: "brand", label: "Brand Brain" },
  { key: "concepts", label: "Concepts" },
];

export default async function CreativePage({ searchParams }: { searchParams: Promise<{ days?: string; tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "fatigue";
  const data = await loadCockpit(parseDays(sp.days));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight">Creative</h1>
      </div>

      <Tabs tabs={TABS} />

      {tab === "fatigue" && <FatigueSection data={data} days={data.days} />}
      {tab === "diversity" && <DiversitySection data={data} days={data.days} />}
      {tab === "brand" && <BrandBrainSection />}
      {tab === "concepts" && <ConceptsSection />}
    </div>
  );
}
