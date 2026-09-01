"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Owner-only private-beta access management. Lists profiles and lets the admin Approve / Suspend / Revoke.
// All authority is server-side (/api/admin/access is isAdminEmail-gated + service-role); this is only the UI.
type Row = { id: string; email: string | null; access_state: string; approved_at: string | null; created_at: string; state_reason: string | null };

const STATE_STYLE: Record<string, string> = {
  APPROVED: "bg-[var(--good-bg)] text-[var(--good-ink)]",
  ACTIVE: "bg-[var(--good-bg)] text-[var(--good-ink)]",
  ADMIN: "bg-[var(--accent-soft)] text-[var(--accent)]",
  WAITLIST: "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
  INVITED: "bg-[var(--surface-alt)] text-[var(--ink-muted)]",
  SUSPENDED: "bg-[var(--bad-bg)] text-[var(--bad-ink)]",
  REVOKED: "bg-[var(--bad-bg)] text-[var(--bad-ink)]",
};

export function AccessAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/admin/access");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      setRows(j.users ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to load");
    }
  }
  useEffect(() => { void load(); }, []);

  async function act(userId: string, action: "approve" | "suspend" | "revoke" | "reinstate") {
    if ((action === "suspend" || action === "revoke") && !confirm(`Really ${action} this user? They lose product access immediately.`)) return;
    setBusy(userId + action);
    setErr(null);
    try {
      const r = await fetch("/api/admin/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, action }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(null);
    }
  }

  const th = "pb-2 pr-4 text-left font-medium text-[var(--ink-muted)]";
  const td = "py-2 pr-4 align-middle text-[var(--ink)]";
  const btn = "rounded-[7px] border border-[var(--hairline)] px-2.5 py-1 text-[12px] font-medium hover:bg-[var(--surface-alt)] disabled:opacity-50";

  if (err && !rows) return <p className="text-[13px] text-[var(--bad-ink)]">{err}</p>;
  if (!rows) return <p className="text-[13px] text-[var(--ink-muted)]">Loading…</p>;
  if (rows.length === 0) return <p className="text-[13px] text-[var(--ink-muted)]">No users yet.</p>;

  return (
    <div>
      {err && <p className="mb-2 text-[12px] text-[var(--bad-ink)]">{err}</p>}
      <table className="w-full text-[13px]">
        <thead><tr className="border-b border-[var(--hairline)]"><th className={th}>Email</th><th className={th}>State</th><th className={th}>Since</th><th className={th}>Actions</th></tr></thead>
        <tbody>
          {rows.map((u) => {
            const entitled = u.access_state === "APPROVED" || u.access_state === "ACTIVE" || u.access_state === "ADMIN";
            return (
              <tr key={u.id} className="border-b border-[var(--hairline)] last:border-0">
                <td className={td}>{u.email ?? u.id.slice(0, 8)}</td>
                <td className={td}><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_STYLE[u.access_state] ?? "bg-[var(--surface-alt)]"}`}>{u.access_state}</span></td>
                <td className={`${td} text-[var(--ink-muted)]`}>{(u.created_at ?? "").slice(0, 10)}</td>
                <td className={td}>
                  <div className="flex flex-wrap gap-1.5">
                    {!entitled && <Button variant="ghost" size="sm" className={btn} disabled={!!busy} onClick={() => act(u.id, "approve")}>Approve</Button>}
                    {entitled && u.access_state !== "ADMIN" && <Button variant="ghost" size="sm" className={btn} disabled={!!busy} onClick={() => act(u.id, "suspend")}>Suspend</Button>}
                    {u.access_state === "SUSPENDED" && <Button variant="ghost" size="sm" className={btn} disabled={!!busy} onClick={() => act(u.id, "reinstate")}>Reinstate</Button>}
                    {u.access_state !== "ADMIN" && u.access_state !== "REVOKED" && <Button variant="ghost" size="sm" className={btn} disabled={!!busy} onClick={() => act(u.id, "revoke")}>Revoke</Button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
