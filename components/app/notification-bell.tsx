"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// The Notification Center bell: a live activity feed + intelligent failure surfacing for the signed-in
// user. Polls /api/notifications on mount, on window focus, and while open, so the user sees what's
// happening in parallel with their work and, when something breaks, WHY + what to do (the server already
// translated the technical error into plain English - this only renders it).

type Notif = {
  id: string; kind: string; status: "running" | "success" | "error" | "info" | "warning";
  title: string; detail: string | null; action: string | null; read_at: string | null; updated_at: string;
};

const DOT: Record<Notif["status"], string> = {
  running: "var(--ink-muted)",
  success: "#16a34a",
  info: "#0a66c2",
  warning: "#d97706",
  error: "#dc2626",
};

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json()) as { items: Notif[]; unread: number };
      setItems(d.items ?? []);
      setUnread(d.unread ?? 0);
    } catch { /* offline / signed out: leave the feed as-is, never crash the topbar */ }
  }, []);

  // Poll: on mount, on focus, and every 60s while the panel is open.
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [open, load]);

  // Close on outside click OR Escape. A11y (Phase-0 audit): this was the only popover in the app with
  // outside-click but no Escape handler - every other dropdown/dialog closes on Escape, so this matches them.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markAllRead() {
    setUnread(0);
    setItems((xs) => xs.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    try { await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" }); } catch { /* best-effort */ }
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={() => { const next = !open; setOpen(next); if (next && unread) markAllRead(); }}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative rounded-full border border-[var(--hairline)] bg-[var(--surface)] p-2 text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#dc2626] px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-96 overflow-hidden rounded-lg border border-[var(--hairline)] bg-[var(--surface)] text-left shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--hairline)] px-3.5 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--ink)]">Notifications</span>
            {items.some((x) => !x.read_at) && (
              <Button type="button" variant="link" size="sm" onClick={markAllRead} className="h-auto p-0 text-[11px] text-[var(--accent)] hover:underline">Mark all read</Button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3.5 py-8 text-center text-[13px] text-[var(--ink-muted)]">You&apos;re all caught up.</div>
            ) : (
              items.map((n) => (
                <div key={n.id} className="flex gap-2.5 border-b border-[var(--hairline)] px-3.5 py-3 last:border-0">
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: DOT[n.status] }} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium text-[var(--ink)]">{n.title}</span>
                      <span className="flex-shrink-0 text-[11px] text-[var(--ink-muted)]">{ago(n.updated_at)}</span>
                    </div>
                    {n.detail && <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-muted)]">{n.detail}</p>}
                    {n.action && <p className="mt-1 text-[12px] font-medium text-[var(--accent)]">{n.action}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
