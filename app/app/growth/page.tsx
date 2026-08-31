import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { latestBrief, pendingDrafts } from "@/lib/growth/store";
import { ReviewQueue } from "@/components/app/growth/ReviewQueue";

// Scout - the growth agent's owner console. Not in the nav; reachable at /app/growth. Gated by ADMIN_EMAILS.
// Shows the latest daily brief: what Scout discovered, scored, and decided - with conversation LINKS and any
// drafted replies. It makes the invisible agent visible. It publishes nothing; "posted" is always 0 by design.
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const DECISION_STYLE: Record<string, string> = {
  DRAFT: "bg-[var(--good-bg)] text-[var(--good-ink)]",
  REQUEST_APPROVAL: "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
  LEARN: "bg-[var(--accent-soft)] text-[var(--accent)]",
  MONITOR: "bg-[var(--surface-alt)] text-[var(--ink-muted)]",
  IGNORE: "bg-[var(--surface-alt)] text-[var(--ink-muted)]",
};

export default async function GrowthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  if (!email || !isAdminEmail(email)) {
    return (
      <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5 text-[14px] text-[var(--ink-muted)]">
        Scout (the growth agent) is for administrators only.
        {email ? <span className="mt-1 block text-[12px]">Signed in as {email}. To grant access, add this email to ADMIN_EMAILS in Vercel.</span> : null}
      </div>
    );
  }

  const [brief, queue] = await Promise.all([latestBrief(), pendingDrafts()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-normal tracking-tight">Scout</h1>
          <span className="rounded-full bg-[var(--good-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--good-ink)]">0 posted</span>
        </div>
        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">The growth agent. It listens for high-intent conversations, scores them, and drafts replies for your review. It never posts anything - every reply is yours to send.</p>
      </div>

      <div className="rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="text-[15px] font-semibold">Review queue{queue.length > 0 ? ` (${queue.length})` : ""}</h2>
        <p className="mt-1 mb-3 text-[13px] text-[var(--ink-muted)]">Scout drafted these for you. Read, then &quot;Copy reply &amp; open thread&quot; to post it yourself, or Dismiss. Scout never posts.</p>
        <ReviewQueue initial={queue} />
      </div>

      {!brief ? (
        <div className="rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)] p-6 text-sm text-[var(--ink-muted)]">
          No brief yet. Scout runs daily (and on the 2-hourly schedule once CRON_SECRET is set as a GitHub secret). The first brief appears here after its next run.
        </div>
      ) : (
        <>
          <div className="rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
            <div className="text-[13px] text-[var(--ink-muted)]">Latest brief · {brief.generatedAt.slice(0, 10)}</div>
            <div className="mt-1 text-[15px]">
              Discovered <b>{brief.discovered}</b> conversations ·{" "}
              {brief.byAction.DRAFT} draft · {brief.byAction.REQUEST_APPROVAL} needs-approval · {brief.byAction.LEARN} learn · {brief.byAction.MONITOR} monitor · {brief.byAction.IGNORE} ignore
            </div>
          </div>

          {brief.demandSignals.length > 0 && (
            <div className="rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
              <h2 className="text-[15px] font-semibold">Demand signals · content ideas</h2>
              <ul className="mt-3 space-y-2">
                {brief.demandSignals.map((d) => (
                  <li key={d.topic} className="text-[13px]"><b>{d.topic}</b> ({d.count} asking) → {d.contentIdea}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
            <h2 className="text-[15px] font-semibold">Top opportunities (for your review — nothing is posted)</h2>
            {brief.topOpportunities.length === 0 ? (
              <p className="mt-3 text-[13px] text-[var(--ink-muted)]">Nothing scored high enough to draft this run. Silence is a valid decision.</p>
            ) : (
              <ul className="mt-3 space-y-4">
                {brief.topOpportunities.map((o, i) => (
                  <li key={i} className="border-t border-[var(--surface-alt)] pt-3 first:border-0 first:pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <a href={o.conversation.url} target="_blank" rel="noopener noreferrer" className="text-[14px] font-medium text-[var(--accent)] hover:underline">
                        {o.conversation.title ?? o.conversation.url}
                      </a>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${DECISION_STYLE[o.decision] ?? ""}`}>{o.decision} · {Math.round(o.score * 100)}/100</span>
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--ink-muted)]">{o.conversation.community} · {o.conversation.url}</div>
                    {o.why?.[0] && <div className="mt-1 text-[12px] text-[var(--ink-muted)]">{o.why[0]}</div>}
                    <div className="mt-1 text-[12px] text-[var(--ink-muted)]">{o.promote?.mayMention ? "AdScale mention permitted (be useful first)" : "No product mention here — be useful only."}</div>
                    {o.draft && (
                      <div className="mt-2 rounded-[8px] border border-[var(--hairline)] bg-[var(--bg)] p-3">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Scout&apos;s draft reply — review + post yourself</div>
                        <p className="whitespace-pre-wrap text-[13px] leading-snug text-[var(--ink)]">{o.draft}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[12px] text-[var(--ink-muted)]">Scout drafts; you decide and post. It has no publishing path — "posted" is always 0.</p>
        </>
      )}
    </div>
  );
}
