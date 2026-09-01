import type { AdDiagnosis, FunnelReport, StepRead } from "@/lib/funnel/diagnosis";
import { funnelToContract } from "@/lib/intelligence/from-funnel";
import { ReasoningTrace } from "@/components/intelligence/ReasoningTrace";
import { adsManagerUrl } from "@/lib/app/ads-manager-url";

// Presentational (server component) for the funnel diagnosis. Renders the account verdict, each ad's stage +
// weakest step (or its honest Hold), the funnel chain, and the held (under-floor) ads. No interactivity yet.

const STEP_SHORT: Record<string, string> = {
  link_ctr: "Click-through",
  lpv_rate: "Landing-page view",
  lpv_to_atc: "Add-to-cart",
  atc_to_checkout: "Checkout start",
  checkout_to_purchase: "Purchase",
};
const STAGE_STYLE: Record<string, string> = {
  TOF: "bg-[#e8f0fe] text-[#1a56db]",
  MOF: "bg-[#fef3c7] text-[#92400e]",
  BOF: "bg-[#dcfce7] text-[#166534]",
};

function pct(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)}%`;
}

function Chain({ steps }: { steps: StepRead[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[12px]">
        <thead>
          <tr className="text-left text-[var(--ink-muted)]">
            <th className="py-1 pr-3 font-medium">Step</th>
            <th className="py-1 pr-3 font-medium tabular-nums">This ad</th>
            <th className="py-1 pr-3 font-medium tabular-nums">Own best</th>
            <th className="py-1 pr-3 font-medium tabular-nums">Objective avg</th>
            <th className="py-1 font-medium tabular-nums">Gap</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.key} className="border-t border-[var(--hairline)]">
              <td className="py-1.5 pr-3 text-[var(--ink)]">
                {STEP_SHORT[s.key] ?? s.key}
                {s.thin ? <span className="ml-1.5 rounded bg-[var(--surface-alt)] px-1 text-[10px] text-[var(--ink-muted)]">thin</span> : null}
                {s.weakBar ? <span className="ml-1.5 rounded bg-[var(--surface-alt)] px-1 text-[10px] text-[var(--ink-muted)]">weak bar</span> : null}
              </td>
              <td className="py-1.5 pr-3 tabular-nums text-[var(--ink)]">{pct(s.value)}</td>
              <td className="py-1.5 pr-3 tabular-nums text-[var(--ink-muted)]">{pct(s.ownBest)}</td>
              <td className="py-1.5 pr-3 tabular-nums text-[var(--ink-muted)]">{pct(s.objectiveAvg)}</td>
              <td className="py-1.5 tabular-nums font-medium text-[var(--ink)]">{s.gap == null ? "—" : `${s.gap.toFixed(0)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdCard({ ad, accountId, dateParam }: { ad: AdDiagnosis; accountId: string; dateParam: string }) {
  const href = adsManagerUrl(accountId, ad.adId, { adSetId: ad.adSetId ?? undefined, campaignId: ad.campaignId ?? undefined, dateParam });
  return (
    <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="group inline-flex max-w-full items-center gap-1 text-[14px] font-medium text-[var(--ink)] hover:text-[var(--accent)]">
              <span className="truncate">{ad.name ?? ad.adId}</span>
              <span className="shrink-0 text-[var(--ink-muted)] group-hover:text-[var(--accent)]" aria-hidden>↗</span>
            </a>
          ) : (
            <div className="truncate text-[14px] font-medium text-[var(--ink)]">{ad.name ?? ad.adId}</div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ink-muted)]">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLE[ad.stage.stage] ?? ""}`}>{ad.stage.stage}</span>
            <span>{ad.objective}</span>
            <span>·</span>
            <span>stage confidence {ad.stage.confidence}%</span>
            {ad.stage.reviewRequired ? <span className="rounded bg-[#fef3c7] px-1.5 py-0.5 text-[10px] text-[#92400e]">review</span> : null}
            <span>·</span>
            <span className="tabular-nums">spend {Math.round(ad.spend).toLocaleString()}</span>
          </div>
        </div>
        {ad.leak ? (
          <div className="rounded-[8px] bg-[#fef2f2] px-3 py-2 text-right">
            <div className="text-[11px] uppercase tracking-wide text-[#991b1b]">Weakest step</div>
            <div className="text-[13px] font-semibold text-[#991b1b]">{STEP_SHORT[ad.leak.key] ?? ad.leak.key}</div>
            <div className="text-[11px] text-[#991b1b]">{ad.leak.gap.toFixed(0)}% below own best</div>
          </div>
        ) : (
          <div className="max-w-[280px] rounded-[8px] bg-[var(--surface-alt)] px-3 py-2 text-[11px] text-[var(--ink-muted)]">{ad.hold}</div>
        )}
      </div>
      {ad.stage.reviewRequired ? <p className="mt-2 text-[11px] text-[var(--ink-muted)]">{ad.stage.note}</p> : null}
      <Chain steps={ad.steps} />
      {/* The full §110 reasoning behind this ad's leak/hold - computed from the same diagnosis, no new query. */}
      {(() => {
        const contract = funnelToContract(ad);
        return contract ? <ReasoningTrace contract={contract} /> : null;
      })()}
    </div>
  );
}

export function FunnelReportView({ report, accountName, accountId, since, until }: { report: FunnelReport; accountName: string; accountId: string; since: string; until: string }) {
  const { verdict } = report;
  const dateParam = `${since}_${until}`;
  const leaking = report.ads.filter((a) => a.leak);
  const held = report.ads.filter((a) => !a.leak);

  return (
    <div className="space-y-5">
      {/* verdict */}
      <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <div className="text-[12px] uppercase tracking-wide text-[var(--ink-muted)]">Account verdict · {accountName} · {since} to {until}</div>
        {verdict.headlineStep ? (
          <p className="mt-1 text-[15px] text-[var(--ink)]">
            The step leaking the most spend is <span className="font-semibold">{STEP_SHORT[verdict.headlineStep] ?? verdict.headlineStep}</span>
            {" "}({Math.round(verdict.spendBehindHeadline).toLocaleString()} behind it across {verdict.leakingAds} ad{verdict.leakingAds === 1 ? "" : "s"}).
          </p>
        ) : (
          <p className="mt-1 text-[15px] text-[var(--ink)]">No ad has a leak we can call with confidence yet.</p>
        )}
        <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-[var(--ink-muted)]">
          <span>{verdict.leakingAds} leaking</span>
          <span>{verdict.noLeakAds} held (no confident leak)</span>
          <span>{verdict.heldAds} under the spend floor</span>
        </div>
      </div>

      {report.warnings.map((w, i) => (
        <div key={i} className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface-alt)] px-4 py-2 text-[12px] text-[var(--ink-muted)]">{w}</div>
      ))}

      {leaking.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold text-[var(--ink)]">Ads with a named leak ({leaking.length})</h2>
          {leaking.map((ad) => <AdCard key={ad.adId} ad={ad} accountId={accountId} dateParam={dateParam} />)}
        </section>
      )}

      {held.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold text-[var(--ink)]">Held (no confident leak) ({held.length})</h2>
          {held.map((ad) => <AdCard key={ad.adId} ad={ad} accountId={accountId} dateParam={dateParam} />)}
        </section>
      )}

      {report.held.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-[var(--ink)]">Under the spend floor ({report.held.length})</h2>
          <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-4 text-[12px] text-[var(--ink-muted)]">
            {report.held.map((h) => (
              <div key={h.adId} className="border-t border-[var(--hairline)] py-1.5 first:border-0">{h.name ?? h.adId} — spent {Math.round(h.spend).toLocaleString()}</div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
