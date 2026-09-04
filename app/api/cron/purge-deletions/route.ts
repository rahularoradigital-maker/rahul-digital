import { NextResponse, type NextRequest } from "next/server";
import { cronSecretGate } from "@/lib/app/cron-auth";
import { purgeExpiredDeletions } from "@/lib/account/deletion";

// The purge cron: runs the account-deletion executor for every account whose 14-day grace has elapsed. This is
// the ONLY place the irreversible purge happens - a deletion request only schedules it, so a user has the full
// grace to cancel. CRON_SECRET-gated (never a public way to trigger deletions). Bounded per run; the rest roll
// to the next tick. Wire it in vercel.json on Vercel Pro (Hobby's 2-cron limit is why it is a separate route
// the owner schedules, not auto-run); until then it can be invoked manually with the bearer for a controlled run.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const gate = cronSecretGate(request);
  if (!gate.ok) return gate.response;

  const summary = await purgeExpiredDeletions();
  return NextResponse.json({ ok: true, ...summary });
}
