import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { setAiUser } from "@/lib/ai/context";
import { getUserMetaSession, fetchLiveCockpit } from "@/lib/meta-sync";
import { fetchAccountCurrency, fetchBrandWebsite } from "@/lib/meta-source";
import { resolveCockpitScope } from "@/lib/app/cockpit-data";
import { deriveBrandProfile, loadBrandProfile, saveBrandProfile, type DerivedProfile } from "@/lib/brand/profile";

// Stage 1 of brand understanding: derive a structured brand profile from the account's REAL ad data
// (POST with no body), or save the user's reviewed/edited version as confirmed (POST with a profile).
// GET returns the stored profile. Auth-gated; grounded (Gemini is told never to invent).
export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  setAiUser(user.id); // attribute AI spend to this user
  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ profile: null });
  return NextResponse.json({ profile: await loadBrandProfile(user.id, session.activeExternalId) });
}

// Normalize an incoming (edited) profile into a DerivedProfile - coerce lists, trim strings.
function normalize(p: Record<string, unknown>): DerivedProfile {
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
    : typeof v === "string" ? v.split(/[,;]/).map((x) => x.trim()).filter(Boolean).slice(0, 12)
    : [];
  return {
    category: str(p.category),
    subcategories: arr(p.subcategories),
    keyProducts: arr(p.keyProducts),
    pricePositioning: str(p.pricePositioning),
    targetMarket: str(p.targetMarket),
    brandVoice: str(p.brandVoice),
    summary: str(p.summary),
    website: str(p.website),
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  setAiUser(user.id); // attribute AI spend to this user

  const session = await getUserMetaSession(user.id);
  if (!session) return NextResponse.json({ error: "Connect a Meta ad account first." }, { status: 400 });
  const acct = session.activeExternalId;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // no body = derive fresh
  }

  // Save the reviewed/edited profile as confirmed.
  if (body.profile && typeof body.profile === "object") {
    const existing = await loadBrandProfile(user.id, acct);
    const ok = await saveBrandProfile(user.id, acct, session.activeAccountName, (body.currency as string) ?? existing?.currency ?? null, normalize(body.profile as Record<string, unknown>), "confirmed");
    if (!ok) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
    return NextResponse.json({ ok: true, profile: await loadBrandProfile(user.id, acct) });
  }

  // Derive fresh from real ad data.
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Brand understanding needs GEMINI_API_KEY set in Vercel." }, { status: 400 });
  }
  // Ad names come from a single lightweight active-ads call (not the full ~9s cockpit pull) - names
  // alone are enough for Gemini to read the category/products, and this keeps the derive fast.
  // Ad names come from the cockpit's leaderboard (the ads that actually SPENT - reliable whether
  // active or now paused, unlike the ACTIVE-only /ads edge). Reuse the user's CURRENT window so it
  // hits the warm cache from the cockpit they are viewing, keeping this fast; names alone are enough
  // for Gemini to read the category/products.
  const scope = resolveCockpitScope(await cookies(), 14);
  // Website is discovered from REAL ad landing links (never LLM-guessed) alongside the derive - see
  // fetchBrandWebsite. Runs in parallel so it adds no latency.
  const [currency, live, website] = await Promise.all([
    fetchAccountCurrency(acct, session.token),
    fetchLiveCockpit(user.id, scope.lookbackDays, scope.campaignId, scope.objectives, scope.explicitWindow, scope.weights),
    fetchBrandWebsite(acct, session.token),
  ]);
  const adNames = live.status === "connected" ? live.view.leaderboard.map((a) => a.name).filter((n): n is string => Boolean(n)) : [];
  if (adNames.length === 0) {
    return NextResponse.json({ error: "No ads found to learn from yet. Open the Cockpit first so the account's ads load, then try again." }, { status: 400 });
  }
  const derived = await deriveBrandProfile(session.activeAccountName, currency, adNames, []);
  if (!derived) return NextResponse.json({ error: "Could not read the brand right now. Please try again." }, { status: 502 });
  // Real landing-host website wins over the model's guess; keep any model value only as fallback.
  if (website) derived.website = website;
  await saveBrandProfile(user.id, acct, session.activeAccountName, currency, derived, "draft");
  return NextResponse.json({ ok: true, profile: await loadBrandProfile(user.id, acct) });
}
