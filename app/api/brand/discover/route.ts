import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMetaSession } from "@/lib/meta-sync";
import { searchAdLibraryPages, fetchAdLibraryAds, iso2FromMarket } from "@/lib/meta-source";
import { loadBrandProfile } from "@/lib/brand/profile";
import { buildSearchQueries, shortlistCandidates } from "@/lib/brand/discover";
import { storeCompetitorBrandAds } from "@/lib/competitors/store";
import { humanizeError } from "@/lib/notifications/humanize";
import type { NormalizedAd } from "@/lib/competitors/types";

// Stage 2: auto competitor discovery from the CONFIRMED brand profile, powered by META'S OWN AD LIBRARY
// (ads_archive) using the user's already-connected token - the free, first-party source. No third-party
// key needed.
//  POST {}            -> search the Ad Library by the profile's category/products, return candidate pages
//  POST { track: [] } -> pull the selected candidates' live ads and store them (scoped to the account)
// Auth-gated; grounded (real Ad Library data only).
export const maxDuration = 60;
const PULL_CONCURRENCY = 3; // ads_archive is Meta's own API on the user's token; a little more parallelism is fine

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
  // The Ad Library is filtered by the country the ads reached; derive it from the confirmed profile.
  const country = iso2FromMarket(profile.targetMarket, profile.currency);

  let body: { track?: { pageId: string; name?: string }[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // no body -> search
  }
  const admin = createAdminClient();

  // --- TRACK: pull the chosen candidates' live ads and store them, scoped to the account. ---
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
          ads = await fetchAdLibraryAds(t.pageId, t.name ?? "Competitor", false, country, session!.token);
        } catch (e) {
          // Map the raw Meta error to a fixed, user-safe message (never surface the upstream error text).
          errors.push(humanizeError(e instanceof Error ? e.message : "", `fetching ${t.name ?? "a competitor"}`).detail);
          continue;
        }
        const label = ads[0]?.brandLabel ?? t.name ?? `Page ${t.pageId}`;
        await storeCompetitorBrandAds(admin, {
          userId, accountId, pageId: t.pageId, isMyBrand: false, label,
          adLibraryUrl: `https://www.facebook.com/ads/library/?view_all_page_id=${t.pageId}`, ads,
        });
        brands.push({ name: label, adCount: ads.length });
      }
    }
    await Promise.all(Array.from({ length: Math.min(PULL_CONCURRENCY, Math.max(1, queue.length)) }, worker));
    return NextResponse.json({ ok: true, tracked: brands, errors });
  }

  // --- SEARCH: find candidate competitors from the profile's category + products. ---
  // Unlike a name lookup, an Ad Library keyword search finds the brands actually RUNNING ads for the
  // same products right now - the most honest competitor signal. We search the profile's most
  // discriminating terms, collect the distinct advertiser pages, drop our own brand, and rank the
  // heaviest advertisers first (shortlist). A vague profile that yields no query drops out honestly.
  const terms = buildSearchQueries(profile.category, profile.subcategories, profile.keyProducts, 5);
  const searchTerms = terms.join(" ").trim();
  if (!searchTerms) {
    return NextResponse.json({ error: "Add a category and a few key products to the profile, then confirm again - discovery searches on them." }, { status: 400 });
  }
  let pages;
  try {
    pages = await searchAdLibraryPages(searchTerms, country, session.token, 20);
  } catch (e) {
    // A Graph error here is almost always the token lacking Ad Library access, or a rate limit. Report it
    // honestly (a fixed, user-safe message) instead of a misleading "profile too vague" or the raw Meta text.
    return NextResponse.json({
      ok: true,
      candidates: [],
      suggested: terms,
      lookupError: humanizeError(e instanceof Error ? e.message : "", "searching the Meta Ad Library").detail,
    });
  }
  const candidates = shortlistCandidates(pages, session.activeAccountName ?? "", 10);
  return NextResponse.json({ ok: true, candidates, suggested: terms });
}
