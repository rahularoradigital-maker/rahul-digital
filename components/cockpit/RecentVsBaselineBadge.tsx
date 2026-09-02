import type { RecentVsBaseline } from "@/lib/scoring/recent-vs-baseline";

// One ad's "recent 7 days vs last 30 days" read, on its own metric - the Ads Manager cross-check.
// Green = the recent week is beating the 30-day average, red = below it, grey = holding. Renders nothing
// when there is too little to compare (never a fabricated arrow).

function fmt(metric: string, v: number | null): string {
  if (v == null) return "-";
  const m = metric.toLowerCase();
  if (m.includes("roas")) return `${v.toFixed(2)}x`;
  if (m.includes("ctr")) return `${v.toFixed(2)}%`;
  return `₹${v.toFixed(2)}`; // CPC / CPM / cost per result
}

export function RecentVsBaselineBadge({ r, className = "" }: { r?: RecentVsBaseline | null; className?: string }) {
  if (!r || r.direction === "insufficient" || r.recent == null || r.baseline == null) return null;
  const tone =
    r.direction === "improving"
      ? { color: "#0a7f5b", arrow: "↑", word: "up vs 30d" }
      : r.direction === "worsening"
        ? { color: "#c0392b", arrow: "↓", word: "down vs 30d" }
        : { color: "var(--ink-muted)", arrow: "→", word: "steady vs 30d" };
  const sign = (r.deltaPct ?? 0) >= 0 ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] ${className}`} title={`Recent ${r.recentDays}d ${r.metric} ${fmt(r.metric, r.recent)} vs last ${r.baselineDays}d ${fmt(r.metric, r.baseline)}`}>
      <span className="text-[var(--ink-muted)]">7d vs 30d</span>
      <span style={{ color: tone.color }} className="font-medium">
        {tone.arrow} {r.metric} {fmt(r.metric, r.recent)} vs {fmt(r.metric, r.baseline)} ({sign}
        {(r.deltaPct ?? 0).toFixed(0)}%)
      </span>
    </span>
  );
}
