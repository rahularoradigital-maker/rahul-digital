"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type KeyStatus = { name: string; label: string; source: "db" | "env" | "none"; last4: string | null; updatedAt: string | null };

function KeyRow({ k, onChanged }: { k: KeyStatus; onChanged: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(action?: "delete") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: k.name, value: action ? undefined : value, action }) });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || d.error) { setMsg(d.error ?? "Failed"); }
      else { setMsg(action ? "Removed" : "Saved"); setValue(""); onChanged(); }
    } catch { setMsg("Failed"); }
    setBusy(false);
  }

  const status = k.source === "db" ? `set here · ••••${k.last4 ?? ""}` : k.source === "env" ? `from Vercel · ••••${k.last4 ?? ""}` : "not set";
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--hairline)] py-3 first:border-0">
      <div className="min-w-[180px]">
        <div className="text-[13px] font-medium text-[var(--ink)]">{k.label}</div>
        <div className="text-[12px] text-[var(--ink-muted)]">{status}</div>
      </div>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={k.source === "none" ? "paste key" : "paste new key to rotate"}
        autoComplete="off"
        className="min-w-[200px] flex-1 rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
      />
      <button type="button" disabled={busy || !value.trim()} onClick={() => save()} className="rounded-full bg-[var(--ink)] px-3.5 py-2 text-[12px] font-medium text-white disabled:opacity-50">Save</button>
      {k.source === "db" && <button type="button" disabled={busy} onClick={() => save("delete")} className="rounded-full border border-[var(--hairline)] px-3 py-2 text-[12px] text-[var(--ink-muted)] disabled:opacity-50">Remove</button>}
      {msg && <span className="text-[12px] text-[var(--ink-muted)]">{msg}</span>}
    </div>
  );
}

export function AdminControls({ keys }: { keys: KeyStatus[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  async function invite() {
    if (!email.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/admin/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      setInviteMsg(res.ok && d.ok ? `Invite sent to ${email}` : d.error ?? "Failed");
      if (res.ok && d.ok) setEmail("");
    } catch { setInviteMsg("Failed"); }
    setInviting(false);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">API keys</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">Set or rotate provider keys here - stored encrypted, applied at runtime (no redeploy). Keys are never shown back. Bootstrap secrets (Supabase, encryption key, Meta app secret, cron) stay in Vercel by design.</p>
        <div className="mt-3">
          {keys.map((k) => <KeyRow key={k.name} k={k} onChanged={() => router.refresh()} />)}
        </div>
      </section>

      <section className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Invite a user</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-muted)]">Enter an email and we send them an invite to join. (Delivery uses your configured email provider.)</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="min-w-[220px] flex-1 rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" />
          <button type="button" disabled={inviting || !email.trim()} onClick={invite} className="rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">{inviting ? "Sending..." : "Send invite"}</button>
          {inviteMsg && <span className="text-[12px] text-[var(--ink-muted)]">{inviteMsg}</span>}
        </div>
      </section>
    </div>
  );
}
