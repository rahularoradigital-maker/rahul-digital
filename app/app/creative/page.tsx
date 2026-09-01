import { loadCockpit, parseDays } from "@/lib/app/cockpit-data";
import { getCurrentUser } from "@/lib/app/user";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tabs } from "@/components/app/tabs";
import { FatigueSection } from "@/components/app/creative/fatigue-section";
import { DiversitySection } from "@/components/app/creative/diversity-section";
import { BrandBrainSection } from "@/components/app/creative/brand-brain-section";
import { ConceptsSection } from "@/components/app/creative/concepts-section";
import { loadCompetitorFormatAds } from "@/lib/competitors/data";
import { compareDiversityToCompetitors } from "@/lib/creative/diversity-vs-competitors";
import { getDeepReadCount } from "@/lib/creative/deep-analysis";

// Creative: one consolidated page for the four creative screens (Fatigue, Diversity,
// Brand Brain, Concepts). loadCockpit runs exactly once here; each tab section is a
// pure render over the same CockpitData, so switching tabs never re-fetches.

const TABS = [
  { key: "fatigue", label: "Fatigue" },
  { key: "diversity", label: "Diversity" },
  { key: "brand", label: "Brand Brain" },
  { key: "concepts", label: "Concepts" },
];

// Read the cached Brand Brain / Concepts output for this account (if generated before), so a reload
// shows the last result without re-paying. Best-effort - a miss just means the Generate button shows.
async function loadInsights(userId: string, accountId: string): Promise<Record<string, string>> {
  try {
    const { data } = await createAdminClient()
      .from("creative_insights")
      .select("type, content")
      .eq("user_id", userId)
      .eq("account_external_id", accountId);
    const out: Record<string, string> = {};
    for (const row of (data ?? []) as { type: string; content: string }[]) out[row.type] = row.content;
    return out;
  } catch {
    return {};
  }
}

export const maxDuration = 300; // heavy 90-day day-wise cold pull needs headroom to warm the cache

export default async function CreativePage({ searchParams }: { searchParams: Promise<{ days?: string; tab?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "fatigue";
  const [data, user] = await Promise.all([loadCockpit(parseDays(sp.days)), getCurrentUser()]);
  const insights = data.connected && user ? await loadInsights(user.id, data.accountId) : {};

  // Diversity view compares MY format mix against the competitors already scraped for this account.
  // Only computed when I have a real own-format read AND competitor ads exist; otherwise null so the
  // section shows a quiet "add competitors" note (never a fabricated comparison).
  const ownFormat = data.connected ? data.ownDiversity?.dimensions.find((d) => d.dimension === "format") : undefined;
  const competitorAds = data.connected && user && ownFormat && ownFormat.buckets.length > 0 ? await loadCompetitorFormatAds(user.id, data.accountId) : [];
  const diversityVsCompetitors = ownFormat && ownFormat.buckets.length > 0 && competitorAds.length > 0 ? compareDiversityToCompetitors(ownFormat.buckets, competitorAds) : null;
  // How many creatives have a deep (video-motion) read, so the Diversity tab can show the DNA is richer.
  const deepReadCount = tab === "diversity" && data.connected && user ? await getDeepReadCount(user.id) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-normal tracking-tight">Creative</h1>
      </div>

      <Tabs tabs={TABS} />

      {tab === "fatigue" && <FatigueSection data={data} days={data.days} />}
      {tab === "diversity" && <DiversitySection data={data} days={data.days} competitors={diversityVsCompetitors} deepReadCount={deepReadCount} />}
      {tab === "brand" && <BrandBrainSection initialContent={insights.brand ?? null} />}
      {tab === "concepts" && <ConceptsSection initialContent={insights.concepts ?? null} />}
    </div>
  );
}
