import type { ChangeAnalysis } from "@/lib/scoring/change-analysis";
import type { GrainMix } from "@/lib/scoring/change-ranking";

// Change Impact (Media-Buyer Change Intelligence, Phase 5 UI). Server-rendered read-out of the engine:
// a buyer leaderboard (ranked on outcome, not activity), a change-type rollup (what helps vs hurts on this
// account), and the recent change timeline with per-change verdicts. Honest empty/insufficient states.

const VERDICT_STYLE: Record<string, string> = {
  improved: "bg-[var(--good-bg)] text-[var(--good-ink)]",
  worsened: "bg-[var(--bad-bg)] text-[var(--bad-ink)]",
  flat: "bg-[var(--surface-alt)] text-[var(--ink-muted)]",
  insufficient: "bg-[var(--surface-alt)] text-[var(--ink-muted)]",
};
const pct = (n: number | null) => (n == null ? "-" : `${n >= 0 ? "+" : ""}${n}%`);
const rate = (n: number | null) => (n == null ? "-" : `${Math.round(n * 100)}%`);
// Precision = share of a buyer's verdicts read at the ad level (directly attributable). A low share means the
// hit-rate is mostly ad-set/campaign-level (directional) evidence - shown so a coarse read is never mistaken
// for a precise one. Named after the dominant grain so it reads in plain English, with the ad-level %.
const precision = (g: GrainMix | undefined) => {
  // Trust-boundary guard: a cached analysis written BEFORE this field existed has no grain on its rollups.
  if (!g || g.preciseShare == null) return "-";
  const p = Math.round(g.preciseShare * 100);
  const label = g.ad >= g.adset && g.ad >= g.campaign ? "ad-level" : g.campaign >= g.adset ? "campaign-level" : "ad-set level";
  return `${p}% ad · ${label}`;
};

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
      {sub && <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ChangeImpactSection({ analysis }: { analysis: ChangeAnalysis }) {
  const { buyers, changeTypes, results, judged, skipped } = analysis;
  // The timeline shows changes we could actually score (a clear verdict); "insufficient" reads (too thin, or
  // a neighbour change collapsed the window) are counted in the sub-line, not listed - they were burying the
  // real verdicts, since the newest changes are the most likely to be unscoreable.
  const conclusive = results.filter((r) => r.impact.verdict !== "insufficient");
  const inconclusive = results.length - conclusive.length;
  // Buyer attribution is thin when no buyer has enough ad/ad-set-level outcomes to rank with confidence -
  // common on accounts run at the ad-set/campaign level. We LEAD with the account-level "what tends to work"
  // (which stays rich) and demote the buyer board behind an honest note, rather than implying a confident
  // per-person ranking exists when it does not.
  const confidentBuyers = buyers.filter((b) => b.confident).length;
  // Thin when at most one buyer can be ranked while others can't - the board then can't say much about the
  // team, so we flag it as directional and keep "what tends to work" as the headline.
  const thinAttribution = confidentBuyers <= 1 && buyers.some((b) => !b.confident);

  if (judged === 0) {
    return (
      <Card title="No change impact to show yet">
        <p className="text-[14px] leading-relaxed text-[var(--ink-muted)]">
          The account&apos;s change log syncs nightly. Once your team makes changes (budget, status, targeting, creative)
          and enough time passes to measure the result, each change is scored here as improved, worsened, or flat.
          {skipped > 0 && ` (${skipped} recent change${skipped === 1 ? "" : "s"} are too new to judge yet.)`}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="What tends to work" sub="Change types ranked by how often they improved performance on this account. This account-level read is the most reliable signal here - it does not depend on tying a change to any one person.">
        <div className="flex flex-wrap gap-2">
          {changeTypes.map((t) => (
            <div key={t.changeType} className="rounded-[10px] border border-[var(--hairline)] px-3 py-2 text-[13px]">
              <span className="font-medium capitalize text-[var(--ink)]">{t.changeType}</span>
              <span className="ml-2 text-[var(--ink-muted)]">{rate(t.hitRate)} good</span>
              <span className="ml-2 text-[var(--good-ink)]">{t.improved}↑</span>
              <span className="ml-1 text-[var(--bad-ink)]">{t.worsened}↓</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Media-buyer leaderboard" sub="Ranked on outcomes, not activity. Only human changes count; algorithm moves are excluded. A buyer is credited only for changes attributable at ad / ad-set level (campaign-wide moves aren't tied to one person), and needs at least 3 such changes to rank with confidence. Precision = share measured at ad level (directly attributable); lower = mostly ad-set level (directional).">
        {thinAttribution && (
          <p className="mb-4 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface-alt)] px-3 py-2 text-[12px] leading-relaxed text-[var(--ink-muted)]">
            Limited attributable data on this account: most changes here happen at the ad-set / campaign level, so few can be tied to a single buyer with confidence. Read the ranking below as directional, and lean on &ldquo;What tends to work&rdquo; above for the reliable signal.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="text-left text-[var(--ink-muted)]">
                <th scope="col" className="pb-2 pr-4 font-medium">Buyer</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Hit rate</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Median impact</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Improved</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Worsened</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Flat</th>
                <th scope="col" className="pb-2 pr-4 font-medium">Judged</th>
                <th scope="col" className="pb-2 font-medium">Precision</th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((b) => (
                <tr key={(b.actorId ?? b.actorName) + b.actorName} className="border-t border-[var(--hairline)]">
                  <td className="py-2 pr-4 text-[var(--ink)]">
                    {b.actorName}
                    {!b.confident && <span className="ml-2 rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-[11px] text-[var(--ink-muted)]">low sample</span>}
                  </td>
                  <td className="py-2 pr-4 text-[var(--ink)]">{rate(b.hitRate)}</td>
                  <td className="py-2 pr-4 text-[var(--ink)]">{pct(b.medianDeltaPct)}</td>
                  <td className="py-2 pr-4 text-[var(--good-ink)]">{b.improved}</td>
                  <td className="py-2 pr-4 text-[var(--bad-ink)]">{b.worsened}</td>
                  <td className="py-2 pr-4 text-[var(--ink-muted)]">{b.flat}</td>
                  <td className="py-2 pr-4 text-[var(--ink-muted)]">{b.usable}</td>
                  <td className="py-2 text-[var(--ink-muted)]">{precision(b.grain)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Recent changes" sub={`${conclusive.length} change${conclusive.length === 1 ? "" : "s"} with a clear verdict${inconclusive > 0 ? `; ${inconclusive} measured but too thin or too close to another change to call` : ""}${skipped > 0 ? `; ${skipped} too new to judge` : ""}.`}>
        {conclusive.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-[var(--ink-muted)]">Changes were logged, but none yet have a clean enough before/after window to score. This resolves as more settled days accumulate between changes.</p>
        ) : (
        <div className="space-y-2">
          {conclusive.slice(0, 40).map((r, i) => (
            <div key={i} className="flex items-start gap-3 border-t border-[var(--hairline)] py-2 first:border-0">
              <span className={`mt-0.5 rounded px-2 py-0.5 text-[11px] font-medium capitalize ${VERDICT_STYLE[r.impact.verdict] ?? ""}`}>{r.impact.verdict}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-[var(--ink)]">
                  <span className="capitalize">{r.changeType}</span>
                  {r.actorName && <span className="text-[var(--ink-muted)]"> by {r.actorName}</span>}
                  {r.source === "algo" && <span className="text-[var(--ink-muted)]"> (algorithm)</span>}
                  {/* Honesty: when a change was too thin to judge on its own, we read the parent - say so, so a
                      looser attribution is never presented as a precise ad-level verdict. */}
                  {r.impact.grain && r.impact.grain !== "ad" && r.impact.verdict !== "insufficient" && (
                    <span className="ml-1 rounded bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] text-[var(--ink-muted)]">measured at {r.impact.grain === "adset" ? "ad-set" : "campaign"} level{r.impact.windowDays ? `, ${r.impact.windowDays}d` : ""}</span>
                  )}
                </div>
                <div className="text-[12px] leading-relaxed text-[var(--ink-muted)]">{r.impact.reason}</div>
              </div>
            </div>
          ))}
        </div>
        )}
      </Card>
    </div>
  );
}
