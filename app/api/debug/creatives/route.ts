import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { metaSource, fetchAdCreatives } from "@/lib/meta-source";
import { deterministicFingerprint } from "@/lib/creative/fingerprint";

// TEMPORARY debug endpoint (auth-gated, own account only): shows exactly what Meta returns for the
// user's own ad creatives, so we can see WHY the format-diversity read is "Unknown". Remove after fix.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ error: "no connected account" }, { status: 400 });

  let ids: string[] = [];
  try {
    const ads = await metaSource.listAds(session.activeExternalId, session.token);
    ids = ads.slice(0, 10).map((a) => a.externalId);
  } catch (e) {
    return NextResponse.json({ step: "listAds", error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  let assets;
  try {
    assets = await fetchAdCreatives(session.activeExternalId, ids, session.token);
  } catch (e) {
    return NextResponse.json({ step: "fetchAdCreatives", ids, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  const sample = ids.map((id) => {
    const a = assets.get(id);
    return {
      id,
      hasAsset: assets.has(id),
      format: a ? deterministicFingerprint(a).format : "unknown",
      imageUrl: a?.imageUrl ?? null,
      videoId: a?.videoId ?? null,
      isVideo: a?.isVideo ?? null,
      isCarousel: a?.isCarousel ?? null,
      assetCount: a?.assetCount ?? null,
      title: a?.title ?? null,
    };
  });

  return NextResponse.json({ account: session.activeExternalId, adsListed: ids.length, assetsSize: assets.size, sample });
}
