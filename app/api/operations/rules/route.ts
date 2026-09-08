import { NextResponse, type NextRequest } from "next/server";
import { guardProductApi } from "@/lib/app/access";
import { createClient } from "@/lib/supabase/server";
import { getUserMetaSession } from "@/lib/meta-sync";
import { getAccountRules, saveAccountRules } from "@/lib/operations/rules-store";

// Phase A2: read/write the per-account automation rules the user authors (max budget step, floor ROAS,
// protected campaigns, creative tone). Scoped to the user's active connected account (or "*" when none).
// Auth-gated; no platform writes - these rules only gate PROPOSALS later.
export const maxDuration = 20;

async function scope(): Promise<{ userId: string; account: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const session = await getUserMetaSession(user.id);
  return { userId: user.id, account: session?.activeExternalId ?? "*" };
}

export async function GET() {
  const s = await scope();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;
  return NextResponse.json({ account: s.account, rules: await getAccountRules(s.userId, s.account) });
}

export async function POST(request: NextRequest) {
  const s = await scope();
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const denied = await guardProductApi();
  if (denied) return denied;
  let patch: unknown = {};
  try {
    patch = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const rules = await saveAccountRules(s.userId, s.account, patch);
  return NextResponse.json({ account: s.account, rules });
}
