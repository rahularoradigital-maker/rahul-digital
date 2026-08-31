import type { GoogleNative } from "@/lib/google/native";
import type { GoogleSeverity } from "@/lib/google/diagnosis";

// Google-native panel: the metrics that actually matter for Google (spend-weighted "most effective on top")
// plus the deterministic engine's ranked actions. Rendered ABOVE the shared cockpit in the Google section so
// the Google levers (impression share, budget-vs-rank, Quality Score, tROAS eligibility) lead - they are NOT
// the Meta funnel. Display-only server component; all logic lives in lib/google/ (pure + gated).

const SEV_STYLE: Record<GoogleSeverity, { dot: string; chip: string; label: string }> = {
  high: { dot: "bg-[var(--bad-ink)]", chip: "bg-[var(--bad-bg)] text-[var(--bad-ink)]", label: "Do now" },
  medium: { dot: "bg-[var(--warn-ink)]", chip: "bg-[var(--warn-bg)] text-[var(--warn-ink)]", label: "Fix" },
  low: { dot: "bg-[var(--ink-muted)]", chip: "bg-[var(--surface-alt)] text-[var(--ink-muted)]", label: "Note" },
};

const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function GoogleNativePanel({ native }: { native: GoogleNative }) {
  const { topMetrics, diagnosis, leadLabel, northStar, demo } = native;
  return (
    <div className="space-y-4">
      {/* Lead metrics - most effective for Google, on top */}
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-[var(--ink-muted)]">
          <span className="font-medium text-[var(--ink)]">Google levers</span>
          <span>·</span>
          <span>most spend in {leadLabel}</span>
          <span>·</span>
          <span>north-star: {northStar}</span>
          {demo ? <span className="ml-auto rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--warn-ink)]">Demo data</span> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {topMetrics.map((m) => (
            <div key={m.key} className="rounded-[8px] border border-[var(--hairline)] bg-[var(--surface-alt)] p-3">
              <div className="text-[12px] text-[var(--ink-muted)]">{m.label}</div>
              <div className="mt-0.5 text-[22px] font-semibold tracking-tight tabular-nums leading-none">{m.value}</div>
              <div className="mt-1.5 text-[11px] leading-snug text-[var(--ink-muted)]">{m.why}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ranked engine findings - deterministic, no AI */}
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex items-center gap-2 text-[13px]">
          <span className="font-medium text-[var(--ink)]">What to change</span>
          <span className="text-[var(--ink-muted)]">· ranked by money at stake · {rupees(diagnosis.totalMoneyAtStake)} in play</span>
        </div>
        <ul className="space-y-2.5">
          {diagnosis.findings.map((f, i) => {
            const s = SEV_STYLE[f.severity];
            return (
              <li key={`${f.campaignId}-${f.rule}-${i}`} className="flex gap-3 border-t border-[var(--hairline)] pt-2.5 first:border-t-0 first:pt-0">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-[var(--ink)]">{f.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.chip}`}>{s.label}</span>
                    <span className="text-[12px] text-[var(--ink-muted)]">{f.campaignName}</span>
                    {f.moneyAtStake > 0 ? <span className="ml-auto text-[12px] tabular-nums text-[var(--ink-muted)]">{rupees(f.moneyAtStake)}</span> : null}
                  </div>
                  <div className="mt-0.5 text-[13px] text-[var(--ink-muted)]">{f.detail}</div>
                  <div className="mt-0.5 text-[13px] text-[var(--ink)]">→ {f.action}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
