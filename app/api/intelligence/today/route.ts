import { NextResponse } from "next/server";
import { loadCockpit } from "@/lib/app/cockpit-data";
import { collectDecisions } from "@/lib/intelligence/collect";
import { buildDigest, digestSubject } from "@/lib/intelligence/digest";

// The daily decision brief as data + text, for the current signed-in account (loadCockpit resolves the user's
// own scope - a viewer only ever gets their own account, never another tenant's). Makes the digest readable
// now without waiting for the (gated) email send: the in-app Today card renders the same feed visually, this
// serves the shareable/copyable text. All the logic (aggregation, critic-capped confidence, ranking) is the
// tested lib/intelligence layer; this route is a thin serving wrapper.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 30) || 30));
  const data = await loadCockpit(days);
  if (!data.connected) {
    return NextResponse.json({ connected: false, reason: data.reason ?? "not connected" }, { status: 200 });
  }
  const feed = collectDecisions(data);
  const date = new Date().toISOString().slice(0, 10);
  return NextResponse.json({
    connected: true,
    account: data.accountName,
    date,
    subject: digestSubject(feed),
    markdown: buildDigest(feed, { accountName: data.accountName, date }),
    counts: { priorities: feed.priorities.length, accountReads: feed.accountReads.length },
  });
}
