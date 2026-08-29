import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGeminiText } from "@/lib/gemini";
import { fetchLiveCockpit } from "@/lib/meta-sync";
import { resolveCockpitScope } from "@/lib/app/cockpit-data";
import { loadBrandProfile } from "@/lib/brand/profile";
import { loadCompetitorData } from "@/lib/competitors/data";

// Positioning intelligence: OUR ICP + content pillars vs THEIR ICP + content pillars, synthesized by
// Gemini over REAL data only - our live ads + confirmed brand profile + website (us), and the tracked
// competitors' real Ad Library copy (them). Grounded: the prompt forbids inventing anything, and audience
// claims are flagged as inferences read off the ad copy, never as fact. Cached in creative_insights so it
// persists per account and is not re-paid on reload. When no competitors are tracked, it still returns our
// own ICP + pillars and says so honestly.
export const maxDuration = 60;

function host(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Positioning needs GEMINI_API_KEY set in Vercel." }, { status: 400 });
  }

  const scope = resolveCockpitScope(await cookies(), 30);
  const live = await fetchLiveCockpit(user.id, scope.lookbackDays, scope.campaignId, scope.objectives, scope.explicitWindow, scope.weights);
  if (live.status !== "connected") {
    return NextResponse.json({ error: "Connect a Meta ad account first - positioning works from your real ads." }, { status: 400 });
  }
  const accountId = live.accountExternalId;
  const [profile, competitors] = await Promise.all([
    loadBrandProfile(user.id, accountId),
    loadCompetitorData(user.id, accountId),
  ]);

  // US: real profile + the ads that actually spent (names carry product/offer/angle; verdict/ROAS carry
  // what wins). THEM: each tracked competitor's real Ad Library copy, hooks, CTAs, and landing hosts.
  const us = {
    brand: live.accountName,
    website: profile?.website ?? null,
    category: profile?.category ?? null,
    products: profile?.keyProducts ?? [],
    subcategories: profile?.subcategories ?? [],
    pricePositioning: profile?.pricePositioning ?? null,
    voice: profile?.brandVoice ?? null,
    ourAds: live.view.leaderboard.slice(0, 20).map((a) => ({ ad: a.name, verdict: a.verdict, roas: a.roas })),
  };
  const them = (competitors?.report.competitors ?? []).map((c) => ({
    brand: c.label,
    activeAds: c.activeAds,
    sampleCopy: c.topCreatives.slice(0, 10).map((ad) => ad.body || ad.title).filter((s): s is string => Boolean(s)),
    topHooks: c.topHooks.slice(0, 6).map((h) => h.label),
    ctas: c.ctaMix.slice(0, 5).map((x) => x.label),
    landingHosts: [...new Set(c.topCreatives.map((ad) => host(ad.linkUrl)).filter((h): h is string => Boolean(h)))],
  }));

  const prompt =
    "You are a brand positioning strategist. Using ONLY the DATA below (real Meta ad data for a brand and its" +
    " tracked competitors), write a positioning comparison. Separate FACTS you can measure (the ad copy, product" +
    " names, verdicts, ROAS exactly as given) from INFERENCES you read FROM them (who an ad seems to target, the" +
    " positioning). State anything about audience or persona as an inference ('appears to target', 'the language" +
    " suggests'), never as confirmed fact. Never invent a product, competitor, number, or claim not in the DATA;" +
    " cite real ad names / copy as evidence. Plain Indian English, rupees for money, no hype words, no em dashes." +
    " Write these labelled sections, no preamble:" +
    " 1) OUR ICP - who our ads appear to target (who they are, the occasion or need they buy for, price" +
    " sensitivity), citing our real products and offers as evidence." +
    " 2) COMPETITORS' ICP - who each tracked competitor appears to target and how it differs from ours, one short" +
    " named line per competitor. If DATA.competitors is empty, write exactly: 'No competitors tracked yet - add" +
    " them on the Competitors tab to compare.'" +
    " 3) OUR CONTENT PILLARS - the 3 to 5 recurring themes or angles our ads actually run (for example festive," +
    " wedding, everyday, offer-led), each with a real ad name as evidence." +
    " 4) COMPETITORS' CONTENT PILLARS - the recurring themes across the competitor ad copy, named where possible." +
    " 5) WHITESPACE AND DIFFERENTIATION - angles or audiences competitors own that we do not (a specific, testable" +
    " gap), and where we are already differentiated.";

  const data = { us, competitors: them };
  try {
    const answer = await callGeminiText(`${prompt}\n\nDATA:\n${JSON.stringify(data)}`);
    if (!answer) {
      return NextResponse.json({ error: "Could not generate right now (the model was slow). Please try again." }, { status: 200 });
    }
    await createAdminClient()
      .from("creative_insights")
      .upsert({ user_id: user.id, account_external_id: accountId, type: "positioning", content: answer, model: "gemini", updated_at: new Date().toISOString() }, { onConflict: "user_id,account_external_id,type" })
      .then(undefined, (e) => console.error("[market/positioning] insight cache write failed (recoverable)", e));
    return NextResponse.json({ content: answer, hasCompetitors: them.length > 0 });
  } catch {
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}

// GET returns the cached positioning insight, if any (so it persists across reloads without re-paying).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ content: null });
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("creative_insights")
    .select("content, account_external_id")
    .eq("user_id", user.id)
    .eq("type", "positioning")
    .order("updated_at", { ascending: false })
    .limit(1);
  return NextResponse.json({ content: rows?.[0]?.content ?? null });
}
