"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Small interactive ISLAND (cleanup #5): the per-row Approve / Suspend / Revoke / Reinstate buttons. The
// roster itself is now server-rendered (access-admin.tsx) - only these actions need client JS. After a
// successful action, router.refresh() re-renders the server list with the new state (no client re-fetch).
// All authority is server-side (/api/admin/access, isAdminEmail-gated + service-role); this is only the UI.
const btn = "rounded-[7px] border border-[var(--hairline)] px-2.5 py-1 text-[12px] font-medium hover:bg-[var(--surface-alt)] disabled:opacity-50";
type Action = "approve" | "suspend" | "revoke" | "reinstate";

export function AccessActions({ userId, state }: { userId: string; state: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const entitled = state === "APPROVED" || state === "ACTIVE" || state === "ADMIN";

  async function act(action: Action) {
    if ((action === "suspend" || action === "revoke") && !confirm(`Really ${action} this user? They lose product access immediately.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, action }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "failed");
      startTransition(() => router.refresh()); // re-render the server list with the new state
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!entitled && <Button variant="ghost" size="sm" className={btn} disabled={disabled} onClick={() => act("approve")}>Approve</Button>}
      {entitled && state !== "ADMIN" && <Button variant="ghost" size="sm" className={btn} disabled={disabled} onClick={() => act("suspend")}>Suspend</Button>}
      {state === "SUSPENDED" && <Button variant="ghost" size="sm" className={btn} disabled={disabled} onClick={() => act("reinstate")}>Reinstate</Button>}
      {state !== "ADMIN" && state !== "REVOKED" && <Button variant="ghost" size="sm" className={btn} disabled={disabled} onClick={() => act("revoke")}>Revoke</Button>}
      {err && <span className="text-[11px] text-[var(--bad-ink)]">{err}</span>}
    </div>
  );
}
