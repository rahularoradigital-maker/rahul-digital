import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { loadAdminDashboard } from "@/lib/admin/dashboard";
import { keyStatus } from "@/lib/keys";
import { AdminControls } from "@/components/app/admin/admin-controls";
import { AccessAdmin } from "@/components/app/admin/access-admin";

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
  let keys: Awaited<ReturnType<typeof keyStatus>> = [];
  let loadError: string | null = null;
  try {
    d = await loadAdminDashboard(30);
    keys = await keyStatus();
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

      {/* Website & blog traffic (first-party, cookie-free). Visitors are approximate daily-unique. */}
      <Card title="Website & blog" sub={`Public-site traffic over the last ${d.windowDays} days. Cookie-free; visitors are approximate daily-unique. "Blog reads" = visitors who actually scrolled/stayed, not just landed.`}>
        <div className="grid gap-4 grid-cols-3">
          {[
            { label: "Visitors", value: num(d.website.visitors) },
            { label: "Page views", value: num(d.website.pageViews) },
            { label: "Blog reads", value: num(d.website.blogReads) },
          ].map((s) => (
            <div key={s.label} className="rounded-[10px] border border-[var(--hairline)] p-4">
              <div className="text-[12px] text-[var(--ink-muted)]">{s.label}</div>
              <div className="mt-1 text-[22px] font-semibold text-[var(--ink)]">{s.value}</div>
            </div>
          ))}
        </div>
        {d.website.pageViews === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--ink-muted)]">No traffic recorded yet. Views appear as people visit the public site and blog.</p>
        ) : (
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            <div>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Top pages</div>
              {d.website.topPages.map((p) => (
                <div key={p.path} className="flex justify-between gap-3 border-t border-[var(--hairline)] py-1.5 text-[13px] first:border-0"><span className="truncate text-[var(--ink)]">{p.path}</span><span className="tabular-nums text-[var(--ink-muted)]">{num(p.views)}</span></div>
              ))}
            </div>
            <div>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Top sources</div>
              {d.website.topReferrers.map((r) => (
                <div key={r.host} className="flex justify-between gap-3 border-t border-[var(--hairline)] py-1.5 text-[13px] first:border-0"><span className="truncate text-[var(--ink)]">{r.host}</span><span className="tabular-nums text-[var(--ink-muted)]">{num(r.views)}</span></div>
              ))}
            </div>
            <div>
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Most-read blogs</div>
              {d.website.topBlogs.length === 0 ? <p className="text-[13px] text-[var(--ink-muted)]">No blog reads yet.</p> : d.website.topBlogs.map((b) => (
                <div key={b.slug} className="flex justify-between gap-3 border-t border-[var(--hairline)] py-1.5 text-[13px] first:border-0"><span className="truncate text-[var(--ink)]">{b.slug}</span><span className="tabular-nums text-[var(--ink-muted)]">{num(b.reads)}</span></div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {[
          { label: "Active today (DAU)", value: num(d.overview.dau) },
          { label: "Active 7d (WAU)", value: num(d.overview.wau) },
          { label: "Active 30d (MAU)", value: num(d.overview.mau) },
          { label: "Total users", value: num(d.overview.totalUsers) },
          { label: "New (7d)", value: num(d.overview.newUsers7d) },
          { label: "New (30d)", value: num(d.overview.newUsers30d) },
          { label: "AI-active users", value: num(d.overview.activeAiUsers) },
          { label: "AI cost (30d)", value: usd(d.totalCostUsd) },
        ].map((s) => (
          <div key={s.label} className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-4">
            <div className="text-[12px] text-[var(--ink-muted)]">{s.label}</div>
            <div className="mt-1 text-[20px] font-semibold text-[var(--ink)]">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "AI calls (30d)", value: num(d.totalCalls) },
          { label: "Tokens (30d)", value: num(d.totalTokens) },
          { label: "AI cost (30d)", value: usd(d.totalCostUsd) },
        ].map((s) => (
          <div key={s.label} className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
            <div className="text-[13px] text-[var(--ink-muted)]">{s.label}</div>
            <div className="mt-1 text-[24px] font-semibold text-[var(--ink)]">{s.value}</div>
          </div>
        ))}
      </div>

      <AdminControls keys={keys} />

      <Card title="Beta access" sub="Private beta: approve who can use the product. New signups start on the waitlist.">
        <AccessAdmin />
      </Card>

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

      <Card title="Problems (backend errors)" sub="Recent captured server errors - what's breaking, on which route, and why.">
        {d.problems.length === 0 ? <p className="text-[13px] text-[var(--good-ink)]">No errors captured. 🎉</p> : (
          <div className="space-y-1.5">
            {d.problems.map((p, i) => (
              <div key={i} className="flex items-baseline gap-3 border-t border-[var(--hairline)] py-1.5 text-[13px] first:border-0">
                <span className="w-24 flex-shrink-0 text-[12px] text-[var(--ink-muted)]">{new Date(p.at).toISOString().slice(5, 16).replace("T", " ")}</span>
                <span className="font-medium text-[var(--bad-ink)]">{p.feature}</span>
                <span className="min-w-0 flex-1 truncate text-[var(--ink-muted)]">{p.message}</span>
                <span className="flex-shrink-0 text-[12px] text-[var(--ink-muted)]">{p.user}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Read-path speed (real users)" sub="Core Web Vitals p75 from real /app loads this window - is the dashboard actually fast at scale? (LCP/FCP/TTFB in ms, CLS unitless.)">
        {d.webVitals.every((v) => v.samples === 0) ? (
          <p className="text-[13px] text-[var(--ink-muted)]">No real-user samples yet. They arrive as people use the app.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {d.webVitals.map((v) => {
              const color =
                v.rating === "good" ? "text-[var(--good-ink)]" : v.rating === "poor" ? "text-[var(--bad-ink)]" : v.rating === "needs-improvement" ? "text-[var(--warn-ink)]" : "text-[var(--ink-muted)]";
              const shown = v.p75 === null ? "n/a" : v.metric === "CLS" ? v.p75.toFixed(3) : `${Math.round(v.p75)}ms`;
              return (
                <div key={v.metric} className="rounded-lg border border-[var(--hairline)] p-3">
                  <div className="text-[12px] font-medium text-[var(--ink-muted)]">{v.metric}</div>
                  <div className={`text-[18px] font-semibold tabular-nums ${color}`}>{shown}</div>
                  <div className="text-[11px] text-[var(--ink-muted)]">{v.samples} sample{v.samples === 1 ? "" : "s"}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Spend by user" sub="Which user is spending how much on AI.">
        {d.users.length === 0 ? <Empty /> : (
          <table className="w-full text-[13px]">
            <thead><tr><th scope="col" className={th}>User</th><th scope="col" className={th}>Cost</th><th scope="col" className={th}>Calls</th><th scope="col" className={th}>Prompt tok</th><th scope="col" className={th}>Output tok</th></tr></thead>
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
            <table className="w-full text-[13px]"><thead><tr><th scope="col" className={th}>Provider</th><th scope="col" className={th}>Cost</th><th scope="col" className={th}>Calls</th></tr></thead>
              <tbody>{d.providers.map((p) => (<tr key={p.key} className="border-t border-[var(--hairline)]"><td className={`${td} capitalize`}>{p.key}</td><td className={td}>{usd(p.costUsd)}</td><td className={td}>{num(p.calls)}</td></tr>))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Spend by feature" sub="Which kind of prompt/job runs most.">
          {d.tasks.length === 0 ? <Empty /> : (
            <table className="w-full text-[13px]"><thead><tr><th scope="col" className={th}>Feature</th><th scope="col" className={th}>Cost</th><th scope="col" className={th}>Calls</th></tr></thead>
              <tbody>{d.tasks.map((t) => (<tr key={t.key} className="border-t border-[var(--hairline)]"><td className={`${td} capitalize`}>{t.key}</td><td className={td}>{usd(t.costUsd)}</td><td className={td}>{num(t.calls)}</td></tr>))}</tbody>
            </table>
          )}
        </Card>
        <Card title="Spend by model (API)" sub="Which model/API costs the most.">
          {d.models.length === 0 ? <Empty /> : (
            <table className="w-full text-[13px]"><thead><tr><th scope="col" className={th}>Model</th><th scope="col" className={th}>Cost</th><th scope="col" className={th}>Calls</th></tr></thead>
              <tbody>{d.models.map((m) => (<tr key={m.key} className="border-t border-[var(--hairline)]"><td className={td}>{m.key}</td><td className={td}>{usd(m.costUsd)}</td><td className={td}>{num(m.calls)}</td></tr>))}</tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Feature usage by user" sub="Which user uses which features, and what it costs them.">
        {d.userFeatures.length === 0 ? <Empty /> : (
          <div className="space-y-3">
            {d.userFeatures.map((u) => (
              <div key={u.email} className="border-t border-[var(--hairline)] pt-3 first:border-0 first:pt-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-medium text-[var(--ink)]">{u.email}</span>
                  <span className="text-[13px] text-[var(--ink-muted)]">{usd(u.costUsd)} total</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {u.features.map((f) => (
                    <span key={f.feature} className="rounded-[8px] border border-[var(--hairline)] px-2 py-1 text-[12px] text-[var(--ink-muted)]">
                      <span className="capitalize text-[var(--ink)]">{f.feature}</span> · {num(f.calls)}× · {usd(f.costUsd)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Live activity" sub="Recent meaningful events (logins, connections, feature use).">
        {d.activity.length === 0 ? <Empty /> : (
          <div className="space-y-1.5">
            {d.activity.map((a, i) => (
              <div key={i} className="flex items-baseline gap-3 border-t border-[var(--hairline)] py-1.5 text-[13px] first:border-0">
                <span className="w-28 flex-shrink-0 text-[12px] text-[var(--ink-muted)]">{new Date(a.at).toISOString().slice(5, 16).replace("T", " ")}</span>
                <span className="font-medium text-[var(--ink)]">{a.event}</span>
                {a.feature && <span className="text-[var(--ink-muted)]">{a.feature}</span>}
                <span className="ml-auto text-[12px] text-[var(--ink-muted)]">{a.user}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Audit trail" sub="Recent privileged/security events (who, what, when, result).">
        {d.audit.length === 0 ? <Empty /> : (
          <table className="w-full text-[13px]"><thead><tr><th scope="col" className={th}>When</th><th scope="col" className={th}>Actor</th><th scope="col" className={th}>Action</th><th scope="col" className={th}>Target</th><th scope="col" className={th}>Result</th></tr></thead>
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
          <table className="w-full text-[13px]"><thead><tr><th scope="col" className={th}>Account</th><th scope="col" className={th}>User</th><th scope="col" className={th}>Job</th><th scope="col" className={th}>Status</th><th scope="col" className={th}>Last run</th></tr></thead>
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
