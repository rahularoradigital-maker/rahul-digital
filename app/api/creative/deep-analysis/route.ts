import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit-distributed";
import { guardProductApi } from "@/lib/app/access";
import { setAiUser } from "@/lib/ai/context";
import { getDeepAnalysisStatus, runDeepAnalysis } from "@/lib/creative/deep-analysis";

// Deep creative analysis: a one-time free-plan trial that reads the top-10 spending creatives in depth
// (real video MOTION for videos). Auth-gated; the entitlement + tenant ownership are enforced server-side
// (readToken only returns a token for an account THIS user owns). GET = status + manifest; POST = run.
export const maxDuration = 300; // downloading + inlining up to 10 videos to Gemini needs real headroom

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;
  return NextResponse.json(await getDeepAnalysisStatus(user.id));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;
  // S3 (scale): per-user rate limit - a run downloads + vision-decodes up to 10 videos (heavy AI + bandwidth).
  const rl = await enforceRateLimit(`deep-analysis:${user.id}`, { windowMs: 60_000, max: 3 });
  if (rl.limited) return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Deep analysis is not configured yet (GEMINI_API_KEY missing)." }, { status: 400 });
  }
  setAiUser(user.id); // attribute the AI spend to this user

  let accountId = "";
  try {
    accountId = String(((await request.json()) as { accountId?: string }).accountId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!accountId) return NextResponse.json({ error: "Connect a Meta ad account first." }, { status: 400 });

  try {
    const result = await runDeepAnalysis(user.id, accountId);
    if (!result.ok) {
      const msg =
        result.reason === "used"
          ? "You have used your one free deep analysis. It stays available to view."
          : result.reason === "not_connected"
            ? "Connect this Meta ad account first."
            : result.reason === "no_ads"
              ? "No spending ads found to analyse in the last 90 days."
              : "Could not run deep analysis right now.";
      return NextResponse.json({ ok: false, reason: result.reason, message: msg, reads: result.reads });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[deep-analysis] run failed", e);
    return NextResponse.json({ error: "Deep analysis failed. Please try again." }, { status: 500 });
  }
}
