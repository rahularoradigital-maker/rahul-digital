import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGeminiText } from "@/lib/gemini";
import { fetchLiveCockpit } from "@/lib/meta-sync";
import { resolveCockpitScope } from "@/lib/app/cockpit-data";

// Brand Brain + Concepts: a grounded Gemini analysis of the account's OWN ads. Both read the real
// cockpit view (ad names encode product/offer/format/influencer, plus real verdicts and ROAS) and
// answer using ONLY that data. Result is cached per account in creative_insights so it persists and
// is not re-paid on reload. Uses the free Gemini tier (same provider as Ask + competitor analysis).
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Not configured yet (GEMINI_API_KEY missing)." }, { status: 400 });
  }

  let type = "";
  try {
    type = String(((await request.json()) as { type?: string }).type ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (type !== "brand" && type !== "concepts") {
    return NextResponse.json({ error: "Unknown analysis type." }, { status: 400 });
  }

  const scope = resolveCockpitScope(await cookies(), 30);
  const live = await fetchLiveCockpit(user.id, scope.lookbackDays, scope.campaignId, scope.objectives, scope.explicitWindow, scope.weights);
  if (live.status !== "connected") {
    return NextResponse.json({ error: "Connect a Meta ad account first - I can only work from your real ads." }, { status: 400 });
  }

  const v = live.view;
  // Compact, real-only snapshot: ad NAMES carry the creative signal (product/offer/format/influencer);
  // verdict/ROAS/spend carry what wins vs. bleeds. Nothing invented.
  const data = {
    account: live.accountName,
    window: scope.explicitWindow ? `${scope.explicitWindow.since} to ${scope.explicitWindow.until}` : `last ${scope.lookbackDays} days`,
    accountHealth: v.accountHealth.score,
    totals: live.scopeTotals,
    topAds: v.leaderboard.slice(0, 18).map((a) => ({ ad: a.name, verdict: a.verdict, roas: a.roas, spendRs: a.spendRs, winnerScore: a.winner?.overall ?? null })),
    fatiguing: v.atRiskContributors.map((c) => ({ ad: c.name, roas: c.roas, spendRs: c.spendRs, state: c.fatigueState })),
    wasting: v.waste.status === "ok" ? v.wasteContributors.map((c) => ({ ad: c.name, roas: c.roas, wastedRs: c.amountRs })) : [],
  };

  const common =
    " Use ONLY the DATA below - the brand's REAL Meta ads. Ad names encode the product, offer, format, and influencer. Never invent a product, number, or fact not derivable from the DATA; cite real ad names as evidence. Plain Indian English, rupees for money, no hype words, no em dashes.";
  const prompt =
    type === "brand"
      ? "You are a brand strategist reading a D2C brand's live Meta ads." +
        common +
        " Write four short labelled sections, no preamble: 1) WHAT THIS BRAND SELLS - the products and recurring campaign themes you can see in the ad names. 2) WHAT WINS - the creative angles, formats (video/static/carousel/catalog), offers, and influencer plays that show up in the higher-ROAS / winner ads, each with a real ad name. 3) WHAT IS FADING - angles/formats that are fatiguing or wasting spend, with ad names. 4) POSITIONING AND TONE - the brand's apparent positioning in one or two lines."
      : "You are a creative strategist. Propose exactly 4 NEW creatives to test for this brand, each as a recipe with five named parts on their own lines: SKU, Format, Concept, Offer, Landing - then one line 'Why' that cites a real winning ad it builds on OR a fatiguing ad it replaces." +
        common +
        " Ground every SKU/format/offer in what already appears in the DATA (do not invent products the brand does not run). Prefer formats and angles that are winning, and target the gaps left by ads that are fatiguing or wasting spend. Number them 1 to 4.";

  try {
    const answer = await callGeminiText(`${prompt}\n\nDATA:\n${JSON.stringify(data)}`);
    if (!answer) {
      return NextResponse.json({ error: "Could not generate right now (the model was slow). Please try again." }, { status: 200 });
    }
    // Cache it (best-effort; a failed write must not fail the response).
    await createAdminClient()
      .from("creative_insights")
      .upsert({ user_id: user.id, account_external_id: live.accountExternalId, type, content: answer, model: "gemini", updated_at: new Date().toISOString() }, { onConflict: "user_id,account_external_id,type" })
      .then(undefined, () => {});
    return NextResponse.json({ content: answer });
  } catch {
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
