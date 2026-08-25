import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchLiveCockpit } from "@/lib/meta-sync";
import type { CockpitView, Verdict, Priority } from "@/lib/cockpit/analyze";

// The account cockpit. Shows REAL data from the user's connected Meta account (no dummy
// data). If nothing is connected yet, it shows a Connect screen instead.

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const VERDICT_STYLE: Record<Verdict, { label: string; cls: string }> = {
  winner: { label: "Winner", cls: "bg-emerald-100 text-emerald-800" },
  refresh: { label: "Refresh", cls: "bg-amber-100 text-amber-800" },
  do_not_kill_yet: { label: "Do not kill yet", cls: "bg-sky-100 text-sky-800" },
  loser: { label: "Loser", cls: "bg-red-100 text-red-800" },
};

const PRIORITY_STYLE: Record<Priority, { label: string; cls: string }> = {
  DO_NOW: { label: "Do now", cls: "bg-red-100 text-red-800" },
  DO_NEXT: { label: "Do next", cls: "bg-amber-100 text-amber-800" },
  WATCH: { label: "Watch", cls: "bg-slate-100 text-slate-700" },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const live = await fetchLiveCockpit(user.id);

  if (live.status === "not_connected") return <ConnectPrompt />;
  if (live.status === "error") return <ConnectPrompt error={live.message} />;

  return <Cockpit view={live.view} accountName={live.accountName} adsAnalyzed={live.adsAnalyzed} />;
}

function ConnectPrompt({ error }: { error?: string }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Connect your Meta ad account</h1>
      <p className="mt-3 text-[var(--muted)]">
        AdBrain reads your real ads and tells you what to do next — what to scale, refresh, or kill,
        and why. Connect Meta to pull your live account. Nothing is ever changed automatically.
      </p>
      <a
        href="/api/connect/meta/authorize"
        className="mt-8 inline-block rounded-lg bg-[var(--brand)] px-6 py-3 font-medium text-[var(--brand-foreground)] transition hover:opacity-90"
      >
        Connect Meta
      </a>
      {error && (
        <p className="mt-6 text-sm text-red-500">
          Could not sync: {error}. Try connecting again.
        </p>
      )}
    </div>
  );
}

function Cockpit({ view, accountName, adsAnalyzed }: { view: CockpitView; accountName: string; adsAnalyzed: number }) {
  const health = view.accountHealth;
  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <strong>Live — {accountName}.</strong> Analyzing {adsAnalyzed} of your real ads from the last 30 days.
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account cockpit</h1>
        <p className="mt-1 text-[var(--muted)]">What to do next, with the reason behind every call.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 sm:col-span-1">
          <div className="text-sm text-[var(--muted)]">Account Health</div>
          <div className="mt-1 text-3xl font-semibold">{health.score}<span className="text-lg text-[var(--muted)]">/100</span></div>
          <div className="mt-1 text-xs text-[var(--muted)]">{health.basis} · {health.factLabel}</div>
        </div>
        <Stat label="Spend" value={rupees.format(view.totals.spendRs)} />
        <Stat label="Revenue" value={rupees.format(view.totals.revenueRs)} />
        <Stat label="ROAS" value={view.totals.roas === null ? "n/a" : `${view.totals.roas.toFixed(2)}x`} />
      </div>

      {view.doThis.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Do this next</h2>
          <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)]">
            {view.doThis.map((a, i) => {
              const p = PRIORITY_STYLE[a.priority];
              return (
                <div key={`${a.adId}-${i}`} className="flex items-start gap-3 p-4">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${p.cls}`}>{p.label}</span>
                  <div className="min-w-0">
                    <div className="font-medium">{a.label} <span className="text-[var(--muted)]">— {a.adName}</span></div>
                    <div className="text-sm text-[var(--muted)]">{a.why}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">Nothing is applied automatically. You make each change in your ad account.</p>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold">Creative leaderboard</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr className="border-b border-[var(--border)]">
                <th className="p-3 font-medium">Ad</th>
                <th className="p-3 font-medium">Verdict</th>
                <th className="p-3 font-medium text-right">Score</th>
                <th className="p-3 font-medium text-right">Spend</th>
                <th className="p-3 font-medium text-right">ROAS</th>
                <th className="p-3 font-medium text-right">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {view.leaderboard.map((ad) => {
                const v = VERDICT_STYLE[ad.verdict];
                return (
                  <tr key={ad.id} className="border-b border-[var(--border)] align-top last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{ad.name}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{ad.why[0]}</div>
                    </td>
                    <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span></td>
                    <td className="p-3 text-right tabular-nums">{ad.score.toFixed(0)}</td>
                    <td className="p-3 text-right tabular-nums">{rupees.format(ad.spendRs)}</td>
                    <td className="p-3 text-right tabular-nums">{ad.roas === null ? "n/a" : `${ad.roas.toFixed(1)}x`}</td>
                    <td className="p-3 text-right tabular-nums">{Math.round(ad.confidence * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {view.waste.status === "ok" && (
        <section>
          <h2 className="text-lg font-semibold">Wasted spend</h2>
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
            <div className="text-2xl font-semibold">{rupees.format(view.waste.totalWastedRs)}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              {Math.round(view.waste.shareOfSpend * 100)}% of spend is going to ads the engine flags as spent. Clearing the Do-now list is where this comes back.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
