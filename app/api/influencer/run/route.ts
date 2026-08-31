import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadBrandProfile } from "@/lib/brand/profile";
import { resolveKey } from "@/lib/keys";
import { brandTargetFromProfile } from "@/lib/influencer/brand-target";
import { scrapeCreatorsIgProvider } from "@/lib/influencer/providers/scrapecreators-ig";
import { discoverAndRank } from "@/lib/influencer/discover";
import { saveDiscovery } from "@/lib/influencer/store";
import { guessGender, extractRegion, meetsConfidence, type EngBand, type MinConfidence } from "@/lib/influencer/derive";

// Map an engagement band to the [min,max] rate the discovery filter uses. undefined = use the pipeline default.
function engBandRange(band: EngBand | undefined): [number | undefined, number | undefined] {
  if (band === "1-5") return [0.01, 0.05];
  if (band === "5-10") return [0.05, 0.1];
  if (band === "10+") return [0.1, undefined];
  return [undefined, undefined];
}

// Run one Influencer Hunt discovery for the user's ACTIVE account: derive the brand target from the account's
// confirmed brand profile, discover + rank real creators via ScrapeCreators, and store the ranked run so the
// page renders it instantly. Auth-gated. Every failure is an honest message (no key / no brand / provider
// out of credits / no results), never a crash. Heavy (search + N profile pulls) -> needs the 300s budget.

// Hobby plans cap serverless functions at ~60s regardless of a higher value, so the run is engineered to
// finish well under that (parallel hashtag search + concurrent profile fetches).
export const maxDuration = 60;

export async function POST(request: Request) {
  // Optional filter inputs from the Creators page's "Run search". min-followers drives the discovery floor
  // (what gets found); engagement band is applied during discovery; gender/region/confidence are applied to
  // the ranked result so the stored set matches the user's criteria.
  const filters = (await request.json().catch(() => ({}))) as {
    minFollowers?: number; engagement?: EngBand; gender?: "any" | "f" | "m"; region?: string; minConfidence?: MinConfidence;
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ ok: false, error: "Connect a Meta account first (Settings)." }, { status: 400 });

  const profile = await loadBrandProfile(user.id, session.activeExternalId);
  if (!profile || (!profile.category && profile.keyProducts.length === 0)) {
    return NextResponse.json(
      { ok: false, error: "Set up your brand first: open Market > Brand so we know your category and products to search on." },
      { status: 400 },
    );
  }

  const key = await resolveKey("SCRAPECREATORS_API_KEY");
  if (!key) return NextResponse.json({ ok: false, error: "SCRAPECREATORS_API_KEY is not set." }, { status: 400 });

  const target = brandTargetFromProfile(profile);
  const minFollowers = Number.isFinite(Number(filters.minFollowers)) && Number(filters.minFollowers) > 0 ? Number(filters.minFollowers) : undefined;
  const [minEng, maxEng] = engBandRange(filters.engagement);
  try {
    const { ranked, stats } = await discoverAndRank(scrapeCreatorsIgProvider(key), target, profile.accountName ?? session.activeAccountName, { minFollowers, minEngagement: minEng, maxEngagement: maxEng });
    // Apply the criteria the discovery stage can't (gender/region are read from name/bio; confidence from the score).
    let out = ranked;
    if (filters.gender === "f" || filters.gender === "m") out = out.filter((r) => guessGender(r.creator.name.value).gender === filters.gender);
    if (filters.region && filters.region !== "any") out = out.filter((r) => extractRegion(r.creator.bio.value) === filters.region);
    if (filters.minConfidence && filters.minConfidence !== "any") out = out.filter((r) => meetsConfidence(r.scorecard.quality.confidence, filters.minConfidence!));
    out = out.map((r, i) => ({ ...r, rank: i + 1 }));

    if (out.length === 0) {
      const why = ranked.length === 0 ? "No creators found for this brand's search terms." : "No creators match those filters. Loosen them and search again.";
      return NextResponse.json({ ok: false, error: why, stats }, { status: 200 });
    }
    await saveDiscovery(user.id, session.activeExternalId, target, out, stats);
    return NextResponse.json({ ok: true, count: out.length, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Discovery failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
