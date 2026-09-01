import Link from "next/link";
import { getUsage } from "@/lib/billing/meter";

// Server-rendered token meter (cleanup #5: less client JS). The plan + used/allowance is read ON THE SERVER
// during the layout render - one cheap indexed read, in the same request that already resolved the user -
// instead of a "use client" component that fetched /api/usage in a useEffect and flashed empty until it
// loaded. Pure display now; the only interactive bit is the Upgrade Link, which works in a server component.
// Threshold-coloured bar: accent under 80%, amber at 80%+, red when out. Never breaks the sidebar on error.
export async function UsageMeter({ userId }: { userId: string }) {
  let u: Awaited<ReturnType<typeof getUsage>>;
  try {
    u = await getUsage(userId);
  } catch {
    return null; // getUsage already fails soft, but never let the meter break the whole shell
  }

  const level = u.pct >= 100 ? "over" : u.pct >= 80 ? "warn" : "ok";
  const barColor = level === "over" ? "var(--bad-ink)" : level === "warn" ? "var(--warn-ink)" : "var(--accent)";

  return (
    <div className="mt-4 rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-[var(--ink)]">{u.planLabel} plan</span>
        <span className="text-[var(--ink-muted)] tabular-nums">
          {u.used.toLocaleString("en-US")}/{u.allowance.toLocaleString("en-US")}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, u.pct)}%`, background: barColor }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
        <span>{level === "over" ? "Out of tokens this month" : `${u.remaining.toLocaleString("en-US")} tokens left`}</span>
        {level !== "ok" && (
          <Link href="/pricing" className="font-medium text-[var(--accent)] hover:underline">
            Upgrade
          </Link>
        )}
      </div>
    </div>
  );
}
