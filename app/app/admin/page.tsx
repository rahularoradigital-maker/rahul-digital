import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { loadAdminDashboard } from "@/lib/admin/dashboard";

// Internal admin cost/ops console. Not in the nav; reachable at /app/admin. Gated by the ADMIN_EMAILS
// allowlist (defaults to the founder). Shows per-user + per-provider + per-task AI spend and job health.
export const maxDuration = 60;

const usd = (n: number) => `$${n.toFixed(4)}`;
const num = (n: number) => n.toLocaleString();

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <h2 className="text-[15px] font-semibold text-[var(--ink)]">{title}</h2>
      {sub && <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{sub}</p>}
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  );
}

export default async function AdminPage() {
  // Resolve the email via getUser() (guaranteed to include email) rather than the JWT claims, which may omit
  // it on this project's asymmetric-key setup - that omission would wrongly deny the real admin.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  if (!email || !isAdminEmail(email)) {
    return (
      <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5 text-[14px] text-[var(--ink-muted)]">
        This page is for administrators only.
        {email ? <span className="block mt-1 text-[12px]">Signed in as {email}. To grant access, add this email to ADMIN_EMAILS in Vercel.</span> : <span className="block mt-1 text-[12px]">(No email on the current session - try signing out and back in.)</span>}
      </div>
    );
  }

  let d: Awaited<ReturnType<typeof loadAdminDashboard>> | null = null;
  let loadError: string | null = null;
  try {
    d = await loadAdminDashboard(30);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "failed to load";
  }
  if (!d) {
    return (
      <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5 text-[14px] text-[var(--ink-muted)]">
        Admin data could not load{loadError ? `: ${loadError}` : ""}. The console works once AI usage or sync jobs exist.
      </div>
    );
  }
  const th = "pb-2 pr-4 text-left font-medium text-[var(--ink-muted)]";
  const td = "py-2 pr-4 text-[var(--ink)]";

  return (
    <div className="space-y-6" style={{ fontVariantNumeric: "tabular-nums" }}>
      <div>
        <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">Admin · Cost & Ops</h1>
        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">AI spend, usage, and background-job health over the last {d.windowDays} days. Costs are list-price estimates.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "AI cost (30d)", value: usd(d.totalCostUsd) },
          { label: "AI calls", value: num(d.totalCalls) },
          { label: "Tokens", value: num(d.totalTokens) },
        ].map((s) => (
          <div key={s.label} className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
            <div className="text-[13px] text-[var(--ink-muted)]">{s.label}</div>
            <div className="mt-1 text-[24px] font-semibold text-[var(--ink)]">{s.value}</div>
          </div>
        ))}
      </div>

      <Card title="Connectors & integrations" sub="What's wired and working right now.">
        <div className="flex flex-wrap gap-2">
          {d.connectors.map((c) => (
            <div key={c.name} className="flex items-center gap-2 rounded-[10px] border border-[var(--hairline)] px-3 py-2 text-[13px]">
              <span className="h-2 w-2 rounded-full" style={{ background: c.status === "ok" ? "#16a34a" : c.status === "attention" ? "#d97706" : "var(--ink-muted)" }} aria-hidden="true" />
              <span className="font-medium text-[var(--ink)]">{c.name}</span>
              <span className="text-[var(--ink-muted)]">{c.detail}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Spend by user" sub="Which user is spending how much on AI.">
        {d.users.length === 0 ? <Empty /> : (
          <table className="w-full text-[13px]">
            <thead><tr><th className={th}>User</th><th className={th}>Cost</th><th className={th}>Calls</th><th className={th}>Prompt tok</th><th className={th}>Output tok</th></tr></thead>
            <tbody>{d.users.map((u) => (
              <tr key={u.userId ?? u.email} className="border-t border-[var(--hairline)]">
                <td className={td}>{u.email}</td><td className={td}>{usd(u.costUsd)}</td><td className={td}>{num(u.calls)}</td><td className={td}>{num(u.promptTokens)}</td><td className={td}>{num(u.completionTokens)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Spend by provider">
          {d.providers.length === 0 ? <Empty /> : (
            <table className="w-full text-[13px]"><thead><tr><th className={th}>Provider</th><th className={th}>Cost</th><th className={th}>Calls</th></tr></thead>
              <tbody>{d.providers.map((p) => (<tr key={p.key} className="border-t border-[var(--hairline)]"><td className={`${td} capitalize`}>{p.key}</td><td className={td}>{usd(p.costUsd)}</td><td className={td}>{num(p.calls)}</td></tr>))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Spend by task" sub="Which kind of prompt/job runs most.">
          {d.tasks.length === 0 ? <Empty /> : (
            <table className="w-full text-[13px]"><thead><tr><th className={th}>Task</th><th className={th}>Cost</th><th className={th}>Calls</th></tr></thead>
              <tbody>{d.tasks.map((t) => (<tr key={t.key} className="border-t border-[var(--hairline)]"><td className={`${td} capitalize`}>{t.key}</td><td className={td}>{usd(t.costUsd)}</td><td className={td}>{num(t.calls)}</td></tr>))}</tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Audit trail" sub="Recent privileged/security events (who, what, when, result).">
        {d.audit.length === 0 ? <Empty /> : (
          <table className="w-full text-[13px]"><thead><tr><th className={th}>When</th><th className={th}>Actor</th><th className={th}>Action</th><th className={th}>Target</th><th className={th}>Result</th></tr></thead>
            <tbody>{d.audit.map((a, i) => (
              <tr key={i} className="border-t border-[var(--hairline)]">
                <td className={td}>{new Date(a.at).toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className={td}>{a.actor}</td>
                <td className={td}>{a.action}</td>
                <td className={td}>{a.target}</td>
                <td className={td}>{a.result === "ok" ? <span className="text-[var(--good-ink)]">ok</span> : a.result === "denied" ? <span className="text-[var(--warn-ink)]">denied</span> : <span className="text-[var(--bad-ink)]">{a.result}</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>

      <Card title="Background jobs" sub="Metrics + change sync per connected account.">
        {d.jobs.length === 0 ? <Empty /> : (
          <table className="w-full text-[13px]"><thead><tr><th className={th}>Account</th><th className={th}>User</th><th className={th}>Job</th><th className={th}>Status</th><th className={th}>Last run</th></tr></thead>
            <tbody>{d.jobs.map((j, i) => (
              <tr key={i} className="border-t border-[var(--hairline)]">
                <td className={td}>{j.account}</td><td className={td}>{j.userEmail}</td><td className={td}>{j.detail}</td>
                <td className={td}>{j.lastOk === false ? <span className="text-[var(--bad-ink)]">error{j.lastError ? `: ${j.lastError.slice(0, 60)}` : ""}</span> : j.lastOk ? <span className="text-[var(--good-ink)]">ok</span> : <span className="text-[var(--ink-muted)]">-</span>}</td>
                <td className={td}>{j.lastRunAt ? new Date(j.lastRunAt).toISOString().slice(0, 16).replace("T", " ") : "-"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Empty() {
  return <p className="text-[13px] text-[var(--ink-muted)]">No data yet.</p>;
}
