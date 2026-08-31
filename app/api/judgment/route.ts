import { NextResponse } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { setAiUser } from "@/lib/ai/context";
import { enforceRateLimit } from "@/lib/rate-limit-distributed";
import { judgeAccount, narrate, type AdInput } from "@/lib/judgment/agent";

// The parallel Judge agent, exposed. POST a batch of the dashboard's ads (already scored upstream, mapped to
// the AdInput shape) and get back the Triple-Label verdict for each - Evidence (judgeable?), Agreement (N/3
// signals concur), Confidence (high/med/low) - plus the corpus rule ids behind every call, and an account
// roll-up of what to act on today. It reads no tenant data itself (it judges only the payload it is given),
// so it is safe and side-effect-free. `?narrate=1` adds an optional buyer-language summary from the AI layer;
// the deterministic result stands on its own without it.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ADS = 2000; // an account of ~60 ads is typical; this caps a pathological payload

// Trust boundary: coerce each posted ad into a valid AdInput, dropping anything unusable rather than trusting
// the caller's shape. Missing numbers default to 0 (which the engine reads as "thin" -> not judgeable), so a
// malformed row can never manufacture a confident verdict.
function coerce(x: unknown): AdInput | null {
  if (!x || typeof x !== "object") return null;
  const a = x as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const platform = a.platform === "Google" ? "Google" : "Meta";
  const objectives = ["conversion", "traffic", "engagement", "awareness", "leads", "app_installs"] as const;
  const objective = (objectives as readonly string[]).includes(String(a.objective)) ? (a.objective as AdInput["objective"]) : "conversion";
  const fStates = ["fresh", "watch", "fatiguing", "fatigued"] as const;
  const fState = (fStates as readonly string[]).includes(String(a.fatigueState)) ? (a.fatigueState as AdInput["fatigueState"]) : "watch";
  const traj = ["improving", "stable", "worsening"] as const;
  const fTraj = (traj as readonly string[]).includes(String(a.fatigueTrajectory)) ? (a.fatigueTrajectory as AdInput["fatigueTrajectory"]) : "stable";
  const suff = ["ok", "insufficient_data", "insufficient_spend"] as const;
  const fSuff = (suff as readonly string[]).includes(String(a.fatigueSufficiency)) ? (a.fatigueSufficiency as AdInput["fatigueSufficiency"]) : "ok";
  return {
    id: String(a.id ?? ""),
    name: String(a.name ?? a.id ?? "ad"),
    platform,
    objective,
    spend: num(a.spend),
    adSetSpend: num(a.adSetSpend),
    conversions: num(a.conversions),
    clicks: num(a.clicks),
    impressions: num(a.impressions),
    daysDelivered: num(a.daysDelivered),
    settledDays: num(a.settledDays),
    metricVsMedian: typeof a.metricVsMedian === "number" && Number.isFinite(a.metricVsMedian) ? a.metricVsMedian : null,
    fatigueState: fState,
    fatigueTrajectory: fTraj,
    fatigueSufficiency: fSuff,
    inLearning: a.inLearning === true,
    lifecycle: a.lifecycle as AdInput["lifecycle"],
    level: a.level as AdInput["level"],
  };
}

export async function POST(req: Request) {
  // Require a signed-in user: this endpoint runs CPU-bound judging and, with ?narrate=1, a billed LLM call.
  // Leaving it open is a cost-DoS / open-AI-proxy lever. Every sibling route already gates with getUser().
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const _denied = await guardProductApi();
  if (_denied) return _denied;
  setAiUser(user.id); // attribute AI spend to this user

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const rawAds = (body as { ads?: unknown })?.ads;
  if (!Array.isArray(rawAds)) return NextResponse.json({ error: "body.ads must be an array of ads" }, { status: 400 });
  if (rawAds.length > MAX_ADS) return NextResponse.json({ error: `too many ads (max ${MAX_ADS})` }, { status: 413 });

  const ads = rawAds.map(coerce).filter((a): a is AdInput => a !== null);
  const account = judgeAccount(ads);

  const url = new URL(req.url);
  let narrative: string | null = null;
  if (url.searchParams.get("narrate") === "1") {
    // The narrate path makes a BILLED LLM call, so it must be rate-limited (every sibling AI route is) -
    // otherwise a signed-in user can loop it for unbounded AI spend. The deterministic result above is free.
    if ((await enforceRateLimit(`judgment:${user.id}`, { windowMs: 600_000, max: 20 })).limited) {
      return NextResponse.json({ ...account, narrative: null, error: "Narration rate limit reached; try again shortly." });
    }
    try {
      narrative = await narrate(account);
    } catch {
      narrative = null; // AI is optional; the deterministic result is complete without it
    }
  }

  return NextResponse.json({ ...account, narrative });
}
