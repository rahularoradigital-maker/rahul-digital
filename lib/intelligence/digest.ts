// The daily decision brief as text (charter §4/§160): turn the aggregated DecisionFeed into a plain-English
// "here are your priorities today, ₹ and why" digest for email / Slack / export. Pure - the in-app card (58's
// today-card) renders the same feed visually; this is the deliverable that comes TO the operator. The actual
// email SEND is gated on Rahul's email provider; this file is the content + subject, fully testable.

import type { DecisionFeed } from "./collect.ts";
import type { OutputContract } from "./output-contract.ts";

const inr = (n: number | null | undefined) => (n != null ? `₹${Math.round(n).toLocaleString("en-IN")}` : "");

// A one-line subject the operator will actually open: the money on the table + the count.
export function digestSubject(feed: DecisionFeed): string {
  const total = feed.priorities.reduce((s, c) => s + (c.economicImpactRs ?? 0), 0);
  const n = feed.priorities.length + feed.accountReads.length;
  if (n === 0) return "AdBrain: nothing urgent today";
  if (total > 0) return `AdBrain: ${feed.priorities.length} ad${feed.priorities.length === 1 ? "" : "s"} worth ${inr(total)} to act on`;
  return `AdBrain: ${n} thing${n === 1 ? "" : "s"} to review today`;
}

function line(c: OutputContract): string {
  const rs = c.economicImpactRs != null ? ` (${inr(c.economicImpactRs)} at stake)` : "";
  const name = c.entity?.name ? `${c.entity.name} — ` : "";
  const call = c.decision?.call ?? "Review";
  const why = c.decision?.why ?? c.diagnosis ?? "";
  return `- ${name}${call}${rs}${why ? `: ${why}` : ""}`;
}

// The brief as markdown. topN caps the per-ad list so the email stays scannable (default 5).
export function buildDigest(feed: DecisionFeed, opts: { accountName: string; date?: string; topN?: number }): string {
  const date = opts.date ?? "today";
  const topN = opts.topN ?? 5;
  const out: string[] = [`# ${opts.accountName} — what to act on, ${date}`, ""];

  if (feed.priorities.length === 0 && feed.accountReads.length === 0) {
    out.push("Nothing urgent right now. Everything with enough signal to judge is holding steady.");
    return out.join("\n");
  }

  if (feed.priorities.length) {
    out.push("## Top ads to act on (by money at stake)");
    for (const c of feed.priorities.slice(0, topN)) out.push(line(c));
    if (feed.priorities.length > topN) out.push(`- …and ${feed.priorities.length - topN} more`);
    out.push("");
  }
  if (feed.accountReads.length) {
    out.push("## Account-level");
    for (const c of feed.accountReads) out.push(line(c));
    out.push("");
  }
  out.push("_Nothing is applied automatically. You make each change in your ad account._");
  return out.join("\n");
}
