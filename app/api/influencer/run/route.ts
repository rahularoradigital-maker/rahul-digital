import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadBrandProfile } from "@/lib/brand/profile";
import { resolveKey } from "@/lib/keys";
import { brandTargetFromProfile } from "@/lib/influencer/brand-target";
import { scrapeCreatorsIgProvider } from "@/lib/influencer/providers/scrapecreators-ig";
import { discoverAndRank } from "@/lib/influencer/discover";
import { saveDiscovery } from "@/lib/influencer/store";

// Run one Influencer Hunt discovery for the user's ACTIVE account: derive the brand target from the account's
// confirmed brand profile, discover + rank real creators via ScrapeCreators, and store the ranked run so the
// page renders it instantly. Auth-gated. Every failure is an honest message (no key / no brand / provider
// out of credits / no results), never a crash. Heavy (search + N profile pulls) -> needs the 300s budget.

// Hobby plans cap serverless functions at ~60s regardless of a higher value, so the run is engineered to
// finish well under that (parallel hashtag search + concurrent profile fetches).
export const maxDuration = 60;

export async function POST(request: Request) {
  // Only min-followers is a SEARCH input (it sets the discovery floor - what gets found). Every other filter
  // (engagement band, gender, region, confidence) is applied as an instant DISPLAY filter on the page, never
  // here - so a narrow filter can never overwrite/shrink the stored pool. A search always stores the FULL set.
  const filters = (await request.json().catch(() => ({}))) as { minFollowers?: number };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;

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
  try {
    const { ranked, stats } = await discoverAndRank(scrapeCreatorsIgProvider(key), target, profile.accountName ?? session.activeAccountName, { minFollowers });
    if (ranked.length === 0) {
      return NextResponse.json({ ok: false, error: "No creators found for this brand's search terms. Try refining the brand category/products in Market.", stats }, { status: 200 });
    }
    // Always store the FULL discovered set. Narrowing (engagement/gender/region/confidence) happens on the
    // page as instant display filters, so a search can never overwrite or shrink the pool.
    await saveDiscovery(user.id, session.activeExternalId, target, ranked, stats);
    return NextResponse.json({ ok: true, count: ranked.length, stats });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Discovery failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
