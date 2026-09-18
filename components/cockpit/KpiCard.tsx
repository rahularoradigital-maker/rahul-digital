import type { ReactNode } from "react";
import { FormulaHint } from "./FormulaHint";

// One decision KPI card. Either a real value, or an honest insufficient-data state
// (we never invent a number the CockpitView does not carry). `tip` is the metric's FORMULA,
// revealed on hover/focus of the "i" (canonically from lib/cockpit/formulas.ts). `disclosure`
// is an optional slot for the evidence tag + "how sure?" drawer, so a pillar can be made
// inspectable without this card knowing anything about the canon.
export function KpiCard({
  label,
  tip,
  value,
  sub,
  insufficient,
  disclosure,
}: {
  label: string;
  tip: string;
  value?: string;
  sub?: string;
  insufficient?: string;
  disclosure?: ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <div className="mb-2 flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)]">
        {label}
        <FormulaHint formula={tip} label={label} />
        {disclosure && <span className="ml-auto">{disclosure}</span>}
      </div>
      {insufficient ? (
        <>
          <div className="text-[15px] font-medium text-[var(--ink-muted)]">Not enough data</div>
          <div className="mt-1 text-xs text-[var(--ink-muted)]">{insufficient}</div>
        </>
      ) : (
        <>
          <div className="text-[30px] font-semibold tracking-tight tabular-nums leading-none">{value}</div>
          {sub && <div className="mt-2 text-xs text-[var(--ink-muted)]">{sub}</div>}
        </>
      )}
    </div>
  );
}
