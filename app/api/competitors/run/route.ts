import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMetaSession } from "@/lib/meta-sync";
import { pageIdFromAdLibraryUrl } from "@/lib/scrapecreators";
import { availableSource, collectBrandAds } from "@/lib/competitors/collect";
import { storeCompetitorBrandAds } from "@/lib/competitors/store";
import { notify, notifyFailure } from "@/lib/notifications/store";
import type { NormalizedAd } from "@/lib/competitors/types";

// Stage 2 + 3 of the competitor pipeline: given the user's brand + competitor Ad Library
// URLs, pull every live ad via ScrapeCreators, normalize, and store per-user. Delete-then-
// insert per brand so a re-run reflects the current live set (no stale ads linger). Nothing
// is fabricated: a URL with no page id, or a brand the API cannot fetch, is reported as an
// error, and only real returned ads are stored.

export const maxDuration = 60; // ScrapeCreators paginates a few pages per brand.

type Body = { brandUrl?: string; competitors?: string[] };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;
  const userId = user.id; // capture for use inside the worker closure (TS narrowing doesn't cross it)

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  // (url, isMyBrand) targets: the brand first, then each competitor.
  const targets: { url: string; isMyBrand: boolean }[] = [];
  if (body.brandUrl?.trim()) targets.push({ url: body.brandUrl.trim(), isMyBrand: true });
  for (const c of body.competitors ?? []) {
    if (c?.trim()) targets.push({ url: c.trim(), isMyBrand: false });
  }
  if (targets.length === 0) {
    return NextResponse.json({ ok: false, error: "Add your brand URL and at least one competitor." }, { status: 400 });
  }

  // Scope this competitor set to the user's ACTIVE ad account, so switching account shows that
  // account's own competitors (not another account's). null when no account is connected.
  const session = await getUserMetaSession(userId);
  const accountId = session?.activeExternalId ?? null;

  // Layer 2 is source-independent + keyless-graceful: pick the best available source. With none configured,
  // return an honest "connect a source" state (not a per-brand crash) - the pipeline is live and ready, it
  // just has nothing to collect from yet. Lights up when SCRAPECREATORS_API_KEY or Meta access is added.
  const source = availableSource(!!session);
  if (source === "none") {
    // Persist this as a notification (dedupe-keyed) so the "why is competitor data empty" answer stays in
    // the user's feed, not just this one response they might miss.
    await notify({ userId, kind: "competitor", status: "info", title: "Connect a competitor data source", detail: "Competitor intelligence has no source to pull from yet.", action: "Add a ScrapeCreators API key, or connect Meta Ad Library access.", dedupeKey: `competitor:source:${userId}` });
    return NextResponse.json(
      { ok: false, reason: "no_source", message: "Connect a data source to collect competitor ads: add a ScrapeCreators API key, or connect Meta Ad Library access." },
      { status: 200 },
    );
  }

  const admin = createAdminClient();
  const brands: { label: string; pageId: string; adCount: number; isMyBrand: boolean }[] = [];
  const errors: string[] = [];

  // Resolve page ids up front so a bad URL is an error, not a wasted worker slot.
  const valid: { url: string; isMyBrand: boolean; pageId: string }[] = [];
  for (const t of targets) {
    const pageId = pageIdFromAdLibraryUrl(t.url);
    if (pageId) valid.push({ ...t, pageId });
    else errors.push(`Not a Facebook Ad Library URL: ${t.url}`);
  }

  // Process brands with a small bounded worker pool instead of one-at-a-time. Each brand is
  // independent (its own page_id), so the external pulls overlap and the wall time drops roughly
  // FETCH_CONCURRENCY x. ponytail: the exact ScrapeCreators rate limit is unconfirmed, so keep this
  // conservative - it matches the competitors/analyze pool; raise it only after confirming the limit
  // (a too-high value would surface as per-brand 429 fetch errors, not a crash).
  const FETCH_CONCURRENCY = 2;
  const queue = [...valid];
  async function worker() {
    for (;;) {
      const t = queue.shift();
      if (!t) return;
      let ads: NormalizedAd[];
      try {
        ads = await collectBrandAds(source, t.pageId, t.isMyBrand ? "My brand" : "Competitor", t.isMyBrand, { token: session?.token });
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `Failed to fetch ${t.pageId}`);
        continue;
      }
      const label = ads[0]?.brandLabel ?? (t.isMyBrand ? "My brand" : `Page ${t.pageId}`);

      // Refresh this brand's ads for THIS account via the one shared account-scoped writer.
      await storeCompetitorBrandAds(admin, { userId, accountId, pageId: t.pageId, isMyBrand: t.isMyBrand, label, adLibraryUrl: t.url, ads });
      brands.push({ label, pageId: t.pageId, adCount: ads.length, isMyBrand: t.isMyBrand });
    }
  }
  await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, Math.max(1, queue.length)) }, worker));

  // Surface an out-of-credits / access condition to the feed too (dedupe-keyed): it is an ongoing account
  // state the user should see later, not a transient this-request blip. Clears next successful run.
  const creditIssue = errors.find((e) => /\b402\b|out of credit|payment required|2332002|verif/i.test(e));
  if (creditIssue) {
    await notifyFailure(userId, "competitor", creditIssue, { dedupeKey: `competitor:source:${userId}`, source: "pulling competitor ads" });
  } else if (brands.length > 0) {
    await notify({ userId, kind: "competitor", status: "success", title: "Competitor ads updated", detail: `Refreshed ${brands.length} ${brands.length === 1 ? "brand" : "brands"}.`, dedupeKey: `competitor:source:${userId}` });
  }

  const ok = brands.length > 0;
  return NextResponse.json({ ok, brands, errors }, { status: ok ? 200 : 502 });
}
