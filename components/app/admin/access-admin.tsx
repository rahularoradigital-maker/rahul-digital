import { createAdminClient } from "@/lib/supabase/admin";
import { AccessActions } from "./access-actions";

// Owner-only private-beta roster. SERVER-RENDERED (cleanup #5): the list is read on the server - this whole
// component used to be "use client" and fetched /api/admin/access in a useEffect, flashing "Loading…" first.
// Only the per-row action buttons are a client island now (access-actions.tsx). Safe to query directly: the
// parent /app/admin page returns early for non-admins BEFORE this renders, so only an admin ever reaches it.
type Row = { id: string; email: string | null; access_state: string; created_at: string };

const STATE_STYLE: Record<string, string> = {
  APPROVED: "bg-[var(--good-bg)] text-[var(--good-ink)]",
  ACTIVE: "bg-[var(--good-bg)] text-[var(--good-ink)]",
  ADMIN: "bg-[var(--accent-soft)] text-[var(--accent)]",
  WAITLIST: "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
  INVITED: "bg-[var(--surface-alt)] text-[var(--ink-muted)]",
  SUSPENDED: "bg-[var(--bad-bg)] text-[var(--bad-ink)]",
  REVOKED: "bg-[var(--bad-bg)] text-[var(--bad-ink)]",
};

export async function AccessAdmin() {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id,email,access_state,approved_at,created_at,state_reason")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return <p className="text-[13px] text-[var(--bad-ink)]">Could not load the roster. Try again in a moment.</p>;
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return <p className="text-[13px] text-[var(--ink-muted)]">No users yet.</p>;

  const th = "pb-2 pr-4 text-left font-medium text-[var(--ink-muted)]";
  const td = "py-2 pr-4 align-middle text-[var(--ink)]";

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-[var(--hairline)]">
          <th className={th}>Email</th><th className={th}>State</th><th className={th}>Since</th><th className={th}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((u) => (
          <tr key={u.id} className="border-b border-[var(--hairline)] last:border-0">
            <td className={td}>{u.email ?? u.id.slice(0, 8)}</td>
            <td className={td}><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_STYLE[u.access_state] ?? "bg-[var(--surface-alt)]"}`}>{u.access_state}</span></td>
            <td className={`${td} text-[var(--ink-muted)]`}>{(u.created_at ?? "").slice(0, 10)}</td>
            <td className={td}><AccessActions userId={u.id} state={u.access_state} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
