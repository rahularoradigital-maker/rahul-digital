import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { fetchLiveCockpit } from "@/lib/meta-sync";
import { resolveCockpitScope } from "@/lib/app/cockpit-data";

// Rolling-24h per-user cap on this PAID Claude call, so a signed-in user (or a script on a valid
// session) cannot loop it and run up the bill. Mirrors the competitors DAILY_CREATIVE_CAP pattern.
const ASK_DAILY_CAP = 50;

// "Ask AdBrain": answer a question grounded ONLY in the user's REAL cockpit data. The model is
// handed a compact snapshot of the connected account and told to never invent a number - so an
// answer either cites the real data or says it does not have it. Auth-gated (it makes a paid
// Claude call). Server-only; the key never reaches the browser.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Ask is not configured yet (ANTHROPIC_API_KEY missing)." }, { status: 400 });
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

  try {
    const anthropic = getAnthropic();
    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: `DATA:\n${JSON.stringify(context)}\n\nQUESTION: ${question}` }],
    });
    const answer = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    // Record the spend for the cap (best-effort; a failed log must not fail the answer).
    await admin.from("ask_log").insert({ user_id: user.id }).then(undefined, () => {});
    return NextResponse.json({ answer: answer || "I could not form an answer from your data." });
  } catch {
    return NextResponse.json({ error: "Ask failed. Please try again." }, { status: 500 });
  }
}
