import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runTaskText } from "@/lib/ai/router";
import { enforceRateLimit } from "@/lib/rate-limit-distributed";
import { fetchLiveCockpit } from "@/lib/meta-sync";
import { resolveCockpitScope } from "@/lib/app/cockpit-data";
import { loadCompetitorFormatAds } from "@/lib/competitors/data";
import { compareDiversityToCompetitors } from "@/lib/creative/diversity-vs-competitors";

// Brand Brain + Concepts: a grounded Gemini analysis of the account's OWN ads. Both read the real
// cockpit view (ad names encode product/offer/format/influencer, plus real verdicts and ROAS) and
// answer using ONLY that data. Result is cached per account in creative_insights so it persists and
// is not re-paid on reload. Uses the free Gemini tier (same provider as Ask + competitor analysis).
export const maxDuration = 60; // gemini-flash-latest can cold-start ~25s; a longer generation needs the headroom (result is cached after)

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // Per-user cap: this is a billed Gemini call; block a session from looping it (cost-DoS guard).
  if ((await enforceRateLimit(`analyze:${user.id}`, { windowMs: 600_000, max: 30 })).limited) {
    return NextResponse.json({ error: "Too many requests. Please wait a minute." }, { status: 429 });
  }
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
  const data: Record<string, unknown> = {
    account: live.accountName,
    window: scope.explicitWindow ? `${scope.explicitWindow.since} to ${scope.explicitWindow.until}` : `last ${scope.lookbackDays} days`,
    accountHealth: v.accountHealth.score,
    totals: live.scopeTotals,
    topAds: v.leaderboard.slice(0, 18).map((a) => ({ ad: a.name, verdict: a.verdict, roas: a.roas, spendRs: a.spendRs, winnerScore: a.winner?.overall ?? null })),
    fatiguing: v.atRiskContributors.map((c) => ({ ad: c.name, roas: c.roas, spendRs: c.spendRs, state: c.fatigueState })),
    wasting: v.waste.status === "ok" ? v.wasteContributors.map((c) => ({ ad: c.name, roas: c.roas, wastedRs: c.amountRs })) : [],
  };

  // Own-vs-competitor format gap (deterministic, real Ad Library data, deduped). Grounds Concepts'
  // "where to diversify" in the real gap instead of the account's own ads alone. Best-effort: absent
  // when no competitors are tracked, so the prompt simply gets no gap block. competitorsPctOfAds is
  // PRESENCE only (share of their distinct ads) - a competitor's spend/ROAS is never knowable.
  const ownFmt = live.ownDiversity?.dimensions.find((d) => d.dimension === "format");
  if (ownFmt && ownFmt.buckets.length > 0) {
    const competitorAds = await loadCompetitorFormatAds(user.id, live.accountExternalId);
    const cmp = competitorAds.length > 0 ? compareDiversityToCompetitors(ownFmt.buckets, competitorAds) : null;
    if (cmp) {
      data.competitorFormatGap = {
        basis: cmp.basis,
        formats: cmp.formats.map((f) => ({
          format: f.format,
          youPctOfSpend: f.ownShare === null ? null : Math.round(f.ownShare * 100),
          competitorsPctOfAds: f.competitorShare === null ? null : Math.round(f.competitorShare * 100),
        })),
        gaps: cmp.gaps,
        overConcentration: cmp.overConcentration,
      };
    }
  }

  const common =
    " Use ONLY the DATA below - the brand's REAL Meta ads. Separate two kinds of evidence: FACTS you can" +
    " measure (ROAS, spend, the ad names and verdicts exactly as given) versus INFERENCES you read FROM" +
    " the ad names (the product, offer, positioning). Ad names are HINTS, not proof - state anything derived" +
    " from a name as an inference ('the names suggest', 'appears to'), never as confirmed fact, and flag" +
    " where it needs checking against the real creative. Never invent a product, number, or fact not in the" +
    " DATA; cite real ad names as evidence. Plain Indian English, rupees for money, no hype words, no em dashes.";
  const prompt =
    type === "brand"
      ? "You are a brand strategist reading a D2C brand's live Meta ads." +
        common +
        " Write four short labelled sections, no preamble: 1) WHAT THIS BRAND SELLS - the products and recurring campaign themes you can see in the ad names. 2) WHAT WINS - the creative angles, formats (video/static/carousel/catalog), offers, and influencer plays that show up in the higher-ROAS / winner ads, each with a real ad name. 3) WHAT IS FADING - angles/formats that are fatiguing or wasting spend, with ad names. 4) POSITIONING AND TONE - the brand's apparent positioning in one or two lines."
      : "You are a creative strategist. Propose exactly 4 NEW creatives to test for this brand, each as a recipe with five named parts on their own lines: SKU, Format, Concept, Offer, Landing - then one line 'Why' that cites a real winning ad it builds on OR a fatiguing ad it replaces." +
        " HARD RULE on Format: it MUST be a real creative a team can actually shoot or design and A/B test - a video, a static image, a carousel, UGC / founder-to-camera, a testimonial, and so on. NEVER propose 'Catalog' or a dynamic product ad as the Format: a catalog ad is served automatically from the product feed, so it is not a creative anyone can design or test. When the winning ad you cite is a Catalog ad, that only tells you which SKU and offer sell - propose a real, shootable creative (for example a UGC video or a lifestyle static) for that SAME SKU and offer, so the brand can genuinely test something new and diversify beyond catalog." +
        common +
        " Ground every SKU/offer in what already appears in the DATA (do not invent products the brand does not run). Prefer the ANGLES and OFFERS that are winning, but always express them as a real, testable creative format (never catalog), and target the gaps left by ads that are fatiguing or wasting spend. If DATA.competitorFormatGap is present, use it to pick which real creative FORMAT to diversify into: competitorsPctOfAds is how much of competitors' distinct ads run that format (presence only - you do NOT know their spend or results, so never claim a competitor format 'works' or earns), youPctOfSpend is your own spend share. Favour a format where competitors are heavy and you are light, and note if you are over-concentrated in one format. Number them 1 to 4.";

  try {
    const answer = await runTaskText("analyze-text", `${prompt}\n\nDATA:\n${JSON.stringify(data)}`);
    if (!answer) {
      return NextResponse.json({ error: "Could not generate right now (the model was slow). Please try again." }, { status: 200 });
    }
    // Cache it (RECOVERABLE best-effort: a failed write only means the answer is not cached and will
    // be regenerated next time; it must not fail the response. Log so the failure is observable).
    await createAdminClient()
      .from("creative_insights")
      .upsert({ user_id: user.id, account_external_id: live.accountExternalId, type, content: answer, model: "gemini", updated_at: new Date().toISOString() }, { onConflict: "user_id,account_external_id,type" })
      .then(undefined, (e) => console.error("[creative/analyze] insight cache write failed (recoverable)", e));
    return NextResponse.json({ content: answer });
  } catch {
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
