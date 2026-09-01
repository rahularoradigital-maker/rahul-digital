import type { CockpitAd } from "@/lib/cockpit/analyze";

// Every recommended action carries the context a buyer needs to trust it: the CAMPAIGN OBJECTIVE (what this
// ad is optimised for), the CURRENT ROAS, and whether the objective's own results are trending up or down.
// The trend comes from the day-wise fatigue read, whose trajectory is measured on the objective-appropriate
// metric (ROAS for conversion, reach/rupee for awareness, CTR otherwise) - so "results improving/worsening"
// is honest, not a generic guess. Reused across the action queue, the fatigue card, and the action center.

export const OBJ_LABEL: Record<string, string> = {
  conversion: "Conversions",
  traffic: "Traffic",
  engagement: "Engagement",
  awareness: "Awareness",
  leads: "Leads",
  app_installs: "App installs",
};

const TREND: Record<string, { arrow: string; label: string; cls: string }> = {
  improving: { arrow: "↑", label: "improving", cls: "text-[var(--good-ink)]" },
  worsening: { arrow: "↓", label: "worsening", cls: "text-[var(--bad-ink)]" },
  stable: { arrow: "→", label: "steady", cls: "text-[var(--ink-muted)]" },
};

export function ObjectiveMeta({ ad, className = "" }: { ad: Pick<CockpitAd, "objective" | "roas" | "fatigueRead">; className?: string }) {
  const objective = OBJ_LABEL[ad.objective] ?? ad.objective;
  const roas = ad.roas != null ? `${ad.roas.toFixed(2)}x` : "n/a";
  const tr = ad.fatigueRead?.trajectory ? TREND[ad.fatigueRead.trajectory] : null;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--ink-muted)] ${className}`}>
      <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink)]">{objective}</span>
      <span>ROAS <span className="tabular-nums text-[var(--ink)]">{roas}</span></span>
      {tr && (
        <span className={tr.cls}>
          {tr.arrow} results {tr.label}
        </span>
      )}
    </div>
  );
}
