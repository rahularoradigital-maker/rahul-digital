import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGeminiText } from "@/lib/gemini";
import { fetchLiveCockpit } from "@/lib/meta-sync";
import { resolveCockpitScope } from "@/lib/app/cockpit-data";

// Rolling-24h per-user cap so a signed-in user (or a script on a valid session) cannot loop the AI
// call and hit rate limits / quota. Mirrors the competitors DAILY_CREATIVE_CAP pattern.
const ASK_DAILY_CAP = 50;

// "Ask AdBrain": answer a question grounded ONLY in the user's REAL cockpit data. The model is
// handed a compact snapshot of the connected account and told to never invent a number - so an
// answer either cites the real data or says it does not have it. Uses Gemini (the same free-tier
// provider already wired for creative analysis), so Ask costs nothing to run. Auth-gated;
// server-only - the key never reaches the browser.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Ask is not configured yet (GEMINI_API_KEY missing)." }, { status: 400 });
  }

  let question = "";
  try {
    question = String(((await request.json()) as { question?: string }).question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!question) return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  if (question.length > 500) question = question.slice(0, 500);

  // Enforce the rolling-24h cap BEFORE spending any tokens. On a count-failure we fail open (allow)
  // so a DB hiccup never blocks a paying user; the cap is a cost backstop, not a security control.
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: usedToday } = await admin
    .from("ask_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((usedToday ?? 0) >= ASK_DAILY_CAP) {
    return NextResponse.json({
      answer: `You have reached today's limit of ${ASK_DAILY_CAP} questions. It resets on a rolling 24-hour basis.`,
    });
  }

  // Answer about the SAME scope the user is viewing (window / campaign / objective / weights), and
  // reuse the dashboard's already-warm cockpit cache instead of triggering a separate cold pull.
  const scope = resolveCockpitScope(await cookies(), 14);
  const live = await fetchLiveCockpit(user.id, scope.lookbackDays, scope.campaignId, scope.objectives, scope.explicitWindow, scope.weights);
  if (live.status !== "connected") {
    return NextResponse.json({ answer: "Connect a Meta ad account first - I can only answer from your real account data." });
  }
  const windowLabel = scope.explicitWindow ? `${scope.explicitWindow.since} to ${scope.explicitWindow.until}` : `last ${scope.lookbackDays} days`;

  const v = live.view;
  // Compact, real-only snapshot the model may reason over. Every value here is a real computed
  // number from the connected account; nothing is invented.
  const context = {
    account: live.accountName,
    window: windowLabel,
    accountHealth: { score: v.accountHealth.score, basis: v.accountHealth.basis },
    totals: live.scopeTotals,
    concentration: v.concentration,
    processed: live.processed,
    topActions: v.doThis.slice(0, 8).map((a) => ({ ad: a.adName, action: a.label, why: a.why })),
    topFatiguing: v.atRiskContributors.map((c) => ({ ad: c.name, campaign: c.campaignName, adSet: c.adsetName, roas: c.roas, spendRs: c.spendRs, state: c.fatigueState })),
    waste: v.waste.status === "ok" ? { totalWastedRs: v.waste.totalWastedRs, shareOfSpend: v.waste.shareOfSpend, ads: v.wasteContributors.map((c) => ({ ad: c.name, campaign: c.campaignName, wastedRs: c.amountRs, roas: c.roas })) } : null,
    opportunityLossRs: v.opportunity.totalLossRs,
  };

  const system =
    `You are AdBrain's analyst. Answer the user's question using ONLY the DATA JSON below - the user's REAL connected Meta ad account for the ${windowLabel} (the window they are currently viewing). Rules:` +
    " never invent a number or a fact that is not in the DATA; if the DATA does not contain the answer, say so plainly and name what to connect or check; every number you state must appear in the DATA. Be short and direct, plain Indian English, rupees for money, no hype words, no em dashes.";

  // Count the usage BEFORE the model call. The cap check above only read a count, so logging AFTER a
  // successful answer let N concurrent asks each slip through during Gemini's multi-second latency and
  // blow past the daily cap. Awaiting the insert first shrinks that race to one fast DB round-trip.
  // Same pass ages out this user's rows older than the rolling window, so ask_log stays bounded at
  // ~cap rows/user at 1000 users instead of growing forever. Both are best-effort: a log failure must
  // never fail the answer.
  await admin.from("ask_log").insert({ user_id: user.id }).then(undefined, () => {});
  await admin.from("ask_log").delete().eq("user_id", user.id).lt("created_at", since).then(undefined, () => {});

  try {
    // Gemini takes a single prompt (no separate system role), so fold the rules + data + question
    // into one grounded prompt.
    const answer = await callGeminiText(`${system}\n\nDATA:\n${JSON.stringify(context)}\n\nQUESTION: ${question}`);
    if (!answer) return NextResponse.json({ answer: "I could not form an answer from your data right now. Please try again." });
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: "Ask failed. Please try again." }, { status: 500 });
  }
}
