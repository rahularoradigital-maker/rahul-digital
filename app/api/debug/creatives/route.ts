import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { metaSource } from "@/lib/meta-source";

// TEMPORARY debug endpoint (auth-gated, own account only): returns Meta's RAW response for the
// creative field on the user's own ads, so we can see exactly why format-diversity is "Unknown".
// Remove after fix.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const GRAPH = "https://graph.facebook.com/v21.0";

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
    ids = ads.slice(0, 3).map((a) => a.externalId);
  } catch (e) {
    return NextResponse.json({ step: "listAds", error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  if (ids.length === 0) return NextResponse.json({ note: "no ads listed" });

  const fields = "creative{id,thumbnail_url,image_url,video_id,body,title,object_story_spec,asset_feed_spec}";
  // Per-ad request (the non-deprecated replacement for ?ids=). GET /{ad-id}?fields=creative{...}
  const url = `${GRAPH}/${encodeURIComponent(ids[0])}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(session.token.accessToken)}`;
  try {
    const res = await fetch(url);
    const raw = await res.json();
    return NextResponse.json({ testedId: ids[0], httpStatus: res.status, raw });
  } catch (e) {
    return NextResponse.json({ step: "rawFetch", error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
