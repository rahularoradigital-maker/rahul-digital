import { CompetitorInput } from "@/components/app/market/competitor-input";
import { CompetitorDashboard } from "@/components/app/market/competitor-dashboard";
import { getCurrentUser } from "@/lib/app/user";
import { loadCompetitorData } from "@/lib/competitors/data";
import { getUserMetaSession } from "@/lib/meta-sync";

// Competitor Creative Intelligence, built to the 9-stage pipeline: URL input (manual) ->
// ScrapeCreators data -> processing -> analytics -> LLM creative analysis -> competitive
// engine -> dashboard. Once a user has run the pipeline, this renders the live dashboard
// from stored real Ad Library data (with the input kept below to re-run or add brands).
// Before that, it shows the input + the pipeline map. Nothing is fabricated: the pipeline
// map is a map, and every dashboard number is a count over real ads.

export async function CompetitorsSection() {
  const user = await getCurrentUser();
  // The brand's market seeds competitor discovery so suggestions appear with no typing.
  const session = user ? await getUserMetaSession(user.id) : null;
  const market = session?.activeAccountName ?? "";
  const data = user ? await loadCompetitorData(user.id, session?.activeExternalId ?? null) : null;

  if (data) {
    return (
      <div className="space-y-6">
        <CompetitorDashboard data={data} />
        <details className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
          <summary className="cursor-pointer text-sm font-medium text-[var(--ink)]">Re-run or add competitors</summary>
          <div className="mt-4">
            <CompetitorInput market={market} />
          </div>
        </details>
      </div>
    );
  }

  return <CompetitorsIntro market={market} />;
}

type Status = "ready" | "scrape" | "gemini";

const STAGES: { n: string; title: string; detail: string; status: Status }[] = [
  { n: "1", title: "Input URLs", detail: "Your brand + competitor Facebook Ad Library URLs. The only manual step.", status: "ready" },
  { n: "2", title: "Data collection", detail: "ScrapeCreators pulls every live ad: creative, copy, CTA, landing, dates, platforms.", status: "scrape" },
  { n: "3", title: "Processing", detail: "Clean, dedupe, normalize, and tag brand vs competitor into one standardized dataset.", status: "scrape" },
  { n: "4-6", title: "Analytics", detail: "Per-brand analytics, performance patterns (hooks, CTAs, formats), and the top 10 creatives per brand.", status: "scrape" },
  { n: "7", title: "LLM creative analysis", detail: "42+ attributes per creative (hook, angle, offer, visual, funnel intent) and TOF / MOF / BOF classification.", status: "gemini" },
  { n: "8", title: "Competitive engine", detail: "Comparison table, creative scorecard, hook matrix, offer architecture, creator network, SWOT, gap analysis.", status: "gemini" },
  { n: "9", title: "Dashboard", detail: "Your brand vs competitors, creative and offer intelligence, funnel mix, and the next creatives to test.", status: "gemini" },
];

const BADGE: Record<Status, { label: string; cls: string }> = {
  ready: { label: "Active", cls: "bg-[var(--good-bg)] text-[var(--good-ink)]" },
  scrape: { label: "Needs ScrapeCreators", cls: "bg-[var(--warn-bg)] text-[var(--warn-ink)]" },
  gemini: { label: "Needs Gemini", cls: "bg-[var(--accent-soft)] text-[var(--accent)]" },
};

function CompetitorsIntro({ market }: { market: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight">Competitor Creative Intelligence</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">
          Decode every rival&apos;s live ads from the Facebook Ad Library to find the messages and formats they own and the
          whitespace they leave open. Paste the URLs below; everything after that runs automatically once the data and
          analysis layers are connected.
        </p>
      </div>

      <CompetitorInput market={market} />

      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
        <div className="mb-1 text-base font-semibold">Pipeline</div>
        <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
          Stage 1 is live. The automated stages light up as the ScrapeCreators data layer and the Gemini creative-analysis
          key are connected. No competitor numbers are shown until real Ad Library data flows.
        </div>
        <ol className="space-y-0">
          {STAGES.map((s) => {
            const badge = BADGE[s.status];
            return (
              <li key={s.n} className="flex items-start gap-4 border-t border-[var(--surface-alt)] py-3.5 first:border-t-0 first:pt-0">
                <span className="mt-0.5 w-9 shrink-0 text-center font-mono text-[13px] font-semibold text-[var(--ink-muted)] tabular-nums">
                  {s.n}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{s.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">{s.detail}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
