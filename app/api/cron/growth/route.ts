import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { discoverHN, discoverReddit, discoverStackExchange, discoverGoogleNews } from "@/lib/growth/discover";
import { generateBrief } from "@/lib/growth/brief";
import { draftTop } from "@/lib/growth/draft";
import { saveBrief } from "@/lib/growth/store";
import { INTENT_SIGNALS } from "@/lib/growth/knowledge";

// The 24/7 no-touch growth run (Vercel Cron). Discovers high-intent conversations from FREE sources, scores +
// decides, and stores a daily brief. DRAFTS ONLY - it publishes nothing, anywhere. CRON_SECRET-gated with a
// constant-time compare (matches /api/cron/sync). Runs itself daily with zero human input.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  const presented = request.headers.get("authorization") ?? "";
  const a = Buffer.from(presented);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const queries = INTENT_SIGNALS.map((s) => s.phrases[0]).slice(0, 6);
  // Every free source that works from a server. HN + StackExchange + Google News are live; Reddit joins when
  // its official app is configured. All best-effort - a failing source never breaks the run.
  const [hn, se, gnews, reddit] = await Promise.all([
    discoverHN(queries),
    discoverStackExchange(queries),
    discoverGoogleNews(queries),
    discoverReddit(queries),
  ]);
  const brief = generateBrief([...hn, ...se, ...gnews, ...reddit], Date.now());
  // Scout writes a reply DRAFT for the top opportunities (for review only - never posted). Best-effort.
  await draftTop(brief.topOpportunities);
  await saveBrief(brief);

  return NextResponse.json({
    ok: true,
    day: brief.generatedAt.slice(0, 10),
    discovered: brief.discovered,
    draftable: brief.topOpportunities.length,
    demandSignals: brief.demandSignals.length,
    note: "drafts only; nothing published",
  });
}
