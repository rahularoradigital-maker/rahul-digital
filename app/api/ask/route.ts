import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGeminiText } from "@/lib/gemini";
import { groundedNumbers, ungroundedNumbers } from "@/lib/ask-grounding";
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
export const maxDuration = 60; // headroom for a gemini-flash-latest cold start

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

  // Enforce the rolling-24h cap ATOMICALLY before spending any tokens (ISSUE 03). The old path did
  // count -> compare -> insert, so N concurrent asks could each read the same count and all slip
  // through during Gemini's multi-second latency. reserve_ask_quota serializes count+insert per user
  // in the DB, so the reservation is a true invariant. On an RPC error we fail open (allow) - the cap
  // is a cost backstop for a free provider, not a security control, and a DB hiccup must not block.
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: reserved, error: reserveErr } = await admin.rpc("reserve_ask_quota", {
    p_user: user.id,
    p_cap: ASK_DAILY_CAP,
    p_window_seconds: 24 * 60 * 60,
  });
  if (!reserveErr && reserved === false) {
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

  // Usage was already recorded atomically by reserve_ask_quota above. Just age out this user's rows
  // older than the rolling window so ask_log stays bounded (~cap rows/user). Best-effort.
  await admin.from("ask_log").delete().eq("user_id", user.id).lt("created_at", since).then(undefined, () => {});

  try {
    // Gemini takes a single prompt (no separate system role), so fold the rules + data + question
    // into one grounded prompt.
    const dataJson = JSON.stringify(context);
    const answer = await callGeminiText(`${system}\n\nDATA:\n${dataJson}\n\nQUESTION: ${question}`);
    if (!answer) return NextResponse.json({ answer: "I could not form an answer from your data right now. Please try again." });

    // ISSUE 28: deterministic grounding check. If the answer states a specific number that is not in
    // the DATA (a fabrication the prompt failed to prevent), regenerate ONCE with a stricter template.
    // Tolerant by design (small counts + rounding allowed), so a correct answer is not re-rolled.
    const grounded = groundedNumbers(context);
    const bad = ungroundedNumbers(answer, grounded);
    if (bad.length > 0) {
      console.error(`[ask] ungrounded number(s) ${bad.join(", ")} - regenerating stricter`);
      const strict = await callGeminiText(
        `${system}\n\nEVERY number in your answer MUST be one of these exact values from the DATA: ${[...grounded].join(", ")}. ` +
          `Do not compute, estimate, or round to any other number; if the answer needs a figure not in that list, say you do not have it.\n\nDATA:\n${dataJson}\n\nQUESTION: ${question}`,
      );
      if (strict) return NextResponse.json({ answer: strict });
      // Regeneration failed: return the original but flag that a figure could not be verified.
      return NextResponse.json({ answer: `${answer}\n\n(One or more figures above could not be verified against your data - please double-check in the dashboard.)` });
    }
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: "Ask failed. Please try again." }, { status: 500 });
  }
}
