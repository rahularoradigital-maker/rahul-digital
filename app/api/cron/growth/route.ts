import { NextResponse, type NextRequest } from "next/server";
import { cronSecretGate } from "@/lib/app/cron-auth";
import { discoverHN, discoverReddit, discoverStackExchange, discoverGoogleNews } from "@/lib/growth/discover";
import { generateBrief } from "@/lib/growth/brief";
import { draftTop } from "@/lib/growth/draft";
import { saveBrief, saveDrafts } from "@/lib/growth/store";
import { generateArticle, saveDraftArticle, topicHasArticle } from "@/lib/growth/articles";
import { matchIntent } from "@/lib/growth/engine";
import { recordSourceRun } from "@/lib/growth/sources";
import { INTENT_SIGNALS } from "@/lib/growth/knowledge";

// The 24/7 no-touch growth run (Vercel Cron). Discovers high-intent conversations from FREE sources, scores +
// decides, and stores a daily brief. DRAFTS ONLY - it publishes nothing, anywhere. CRON_SECRET-gated with a
// constant-time compare (matches /api/cron/sync). Runs itself daily with zero human input.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const gate = cronSecretGate(request); // one shared constant-time bearer primitive (was hand-copied here)
  if (!gate.ok) return gate.response;

  const queries = INTENT_SIGNALS.map((s) => s.phrases[0]).slice(0, 6);
  // Every free source that works from a server. HN + StackExchange + Google News are live; Reddit joins when
  // its official app is configured. All best-effort - a failing source never breaks the run.
  const [hn, se, gnews, reddit] = await Promise.all([
    discoverHN(queries),
    discoverStackExchange(queries),
    discoverGoogleNews(queries),
    discoverReddit(queries),
  ]);
  // Source Registry (spec section 5): record each source's health so the owner sees what's working.
  await Promise.all([
    recordSourceRun("hackernews", true, hn.length),
    recordSourceRun("stackexchange", true, se.length),
    recordSourceRun("googlenews", true, gnews.length),
    recordSourceRun("reddit", reddit.length > 0, reddit.length),
  ]);
  const brief = generateBrief([...hn, ...se, ...gnews, ...reddit], Date.now());
  // Scout writes a reply DRAFT for the top opportunities (for review only - never posted). Best-effort.
  await draftTop(brief.topOpportunities);
  await saveBrief(brief);
  await saveDrafts(brief.generatedAt.slice(0, 10), brief.topOpportunities); // queue them for your review

  // Content engine: write ONE draft article for the strongest fresh topic this run (never public until you
  // one-tap publish). Best-effort; skips a topic already covered so it never re-writes the same piece.
  let articleTopic: string | null = null;
  try {
    const topic = brief.demandSignals[0]?.topic ?? matchIntent(brief.topOpportunities[0]?.conversation.content ?? "").topic;
    if (topic && !(await topicHasArticle(topic))) {
      const art = await generateArticle(topic);
      if (art) {
        await saveDraftArticle({ ...art, topic });
        articleTopic = topic;
      }
    }
  } catch {
    /* content engine is best-effort - a failure never breaks the discovery run */
  }

  return NextResponse.json({
    ok: true,
    day: brief.generatedAt.slice(0, 10),
    discovered: brief.discovered,
    draftable: brief.topOpportunities.length,
    demandSignals: brief.demandSignals.length,
    articleDrafted: articleTopic,
    note: "drafts only; nothing published",
  });
}
