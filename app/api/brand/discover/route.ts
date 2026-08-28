import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMetaSession } from "@/lib/meta-sync";
import { searchCompanies, fetchBrandAds } from "@/lib/scrapecreators";
import { loadBrandProfile, suggestCompetitorNames } from "@/lib/brand/profile";
import { shortlistCandidates, type Candidate } from "@/lib/brand/discover";
import type { NormalizedAd } from "@/lib/competitors/types";

// Stage 2: auto competitor discovery from the CONFIRMED brand profile.
//  POST {}            -> search the Ad Library from the profile's category/products, return candidates
//  POST { track: [] } -> pull the selected candidates' ads and store them (scoped to the account)
// Auth-gated; grounded (real Ad Library data only). Requires SCRAPECREATORS_API_KEY.
export const maxDuration = 60;
const PULL_CONCURRENCY = 2; // gentle on the provider's rate limit (matches competitors/run)
const SEARCH_CONCURRENCY = 4; // resolving suggested names is a cheap GET, so a bit more parallelism

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const userId = user.id;

  const session = await getUserMetaSession(userId);
  if (!session) return NextResponse.json({ error: "Connect a Meta ad account first." }, { status: 400 });
  const accountId = session.activeExternalId;

  const profile = await loadBrandProfile(userId, accountId);
  if (!profile || profile.status !== "confirmed") {
    return NextResponse.json({ error: "Confirm the brand profile first - discovery uses it." }, { status: 400 });
  }
  if (!process.env.SCRAPECREATORS_API_KEY) {
    return NextResponse.json({ error: "Competitor discovery needs SCRAPECREATORS_API_KEY set in Vercel." }, { status: 400 });
  }

  let body: { track?: { pageId: string; name?: string }[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // no body -> search
  }
  const admin = createAdminClient();

  // --- TRACK: pull the chosen candidates' ads and store them, scoped to the account. ---
  if (Array.isArray(body.track) && body.track.length > 0) {
    const targets = body.track.filter((t) => t.pageId).slice(0, 8);
    const brands: { name: string; adCount: number }[] = [];
    const errors: string[] = [];
    const queue = [...targets];
    async function worker() {
      for (;;) {
        const t = queue.shift();
        if (!t) return;
        let ads: NormalizedAd[];
        try {
          ads = await fetchBrandAds(t.pageId, t.name ?? "Competitor", false);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : `Failed to fetch ${t.pageId}`);
          continue;
        }
        const label = ads[0]?.brandLabel ?? t.name ?? `Page ${t.pageId}`;
        const del = admin.from("competitor_ads").delete().eq("user_id", userId).eq("page_id", t.pageId);
        await (accountId === null ? del.is("account_external_id", null) : del.eq("account_external_id", accountId));
        const rows = ads.map((a) => ({
          user_id: userId, account_external_id: accountId, page_id: a.pageId, ad_archive_id: a.adArchiveId,
          is_my_brand: false, brand_label: a.brandLabel, is_active: a.isActive, display_format: a.displayFormat,
          media: a.media, cta_text: a.ctaText, cta_type: a.ctaType, title: a.title, body: a.body, link_url: a.linkUrl,
          platforms: a.platforms, start_date: a.startDate, end_date: a.endDate, card_count: a.cardCount, ad_url: a.adUrl,
          image_url: a.imageUrl, video_url: a.videoUrl, video_thumb_url: a.videoThumbUrl,
        }));
        await Promise.all([
          rows.length > 0 ? admin.from("competitor_ads").upsert(rows, { onConflict: "user_id,page_id,ad_archive_id" }) : Promise.resolve(),
          admin.from("competitor_brands").upsert(
            { user_id: userId, account_external_id: accountId, page_id: t.pageId, label, is_my_brand: false, ad_library_url: `https://www.facebook.com/ads/library/?view_all_page_id=${t.pageId}`, ad_count: ads.length, updated_at: new Date().toISOString() },
            { onConflict: "user_id,page_id" },
          ),
        ]);
        brands.push({ name: label, adCount: ads.length });
      }
    }
    await Promise.all(Array.from({ length: Math.min(PULL_CONCURRENCY, Math.max(1, queue.length)) }, worker));
    return NextResponse.json({ ok: true, tracked: brands, errors });
  }

  // --- SEARCH: find candidate competitors from the profile. ---
  // The Ad Library search matches by brand NAME, not product keywords, so we can't search "kurta sets".
  // Instead ask Gemini for real same-market, same-price-band competitor NAMES, then resolve each to a
  // REAL Ad Library page. A wrong/invented name just resolves to nothing and drops out (grounded).
  const names = await suggestCompetitorNames(profile);
  if (names.length === 0) {
    return NextResponse.json({ error: "Could not suggest competitors from this profile. Add category / products and confirm again." }, { status: 400 });
  }
  const all: Candidate[] = [];
  const seen = new Set<string>();
  const nameQueue = [...names];
  let lookupError: string | null = null; // the provider error, if every lookup is failing
  async function resolver() {
    for (;;) {
      const name = nameQueue.shift();
      if (!name) return;
      let results: Candidate[];
      try {
        results = await searchCompanies(name, 3); // ranked best NAME-match first
      } catch (e) {
        lookupError = e instanceof Error ? e.message : "lookup failed";
        continue; // one name failing must not sink discovery
      }
      // Keep the top 1-2 real pages per name; shortlist then dedupes, drops our own brand, ranks.
      for (const r of results.slice(0, 2)) if (r.pageId && !seen.has(r.pageId)) { seen.add(r.pageId); all.push(r); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(SEARCH_CONCURRENCY, Math.max(1, nameQueue.length)) }, resolver));
  const candidates = shortlistCandidates(all, session.activeAccountName ?? "", 10);
  // We got competitor NAMES from Gemini but resolved ZERO real pages AND the lookups were erroring:
  // that is a provider problem (e.g. Ad Library data credits exhausted), not "profile too vague".
  // Surface it honestly with the names we did find, instead of misleading "add more sub-categories".
  if (candidates.length === 0 && lookupError) {
    return NextResponse.json({
      ok: true,
      candidates: [],
      suggested: names,
      lookupError: `Could not look up these brands in the Ad Library (${lookupError}). The competitor data provider may be out of credits.`,
    });
  }
  return NextResponse.json({ ok: true, candidates, suggested: names });
}
