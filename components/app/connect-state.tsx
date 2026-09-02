// The empty state shown whenever a page has no real account data to render.
// There is no sample fallback anywhere in the app: it is real Meta data or this.
// The three reasons are honest and distinct so the user knows exactly what to do.

import type { ConnectReason } from "@/lib/app/cockpit-data";
import { AutoRefresh } from "@/components/app/auto-refresh";

const COPY: Record<ConnectReason, { title: string; body: string }> = {
  not_connected: {
    title: "Connect your Meta account",
    body: "This app only ever shows your real ad data. Connect Meta to pull your live account. Nothing is ever changed automatically.",
  },
  error: {
    title: "We could not reach your Meta account",
    body: "The last sync did not complete. Reconnect, or try again in a moment. We never show placeholder numbers in the meantime.",
  },
  no_data: {
    title: "No ads with spend in this window",
    body: "Your account is connected, but no ads spent in the selected date range. Widen the window from the topbar, or switch to an account that is spending.",
  },
  syncing: {
    title: "Loading your account",
    body: "Pulling this view from Meta - it refreshes here automatically in a few seconds. This happens the first time you open a new filter or window.",
  },
};

export function ConnectState({
  reason,
  errorNote,
  accountName,
  days,
}: {
  reason: ConnectReason;
  errorNote?: string;
  accountName?: string;
  days: number;
}) {
  const copy = COPY[reason];
  const syncing = reason === "syncing";
  return (
    <div className="grid min-h-[52vh] place-items-center">
      <div className="w-full max-w-md rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-8 text-center">
        {syncing && <AutoRefresh seconds={4} />}
        <div className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]${syncing ? " motion-safe:animate-pulse" : ""}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
          </svg>
        </div>
        <h2 className="text-lg font-normal text-[var(--ink)]">{copy.title}</h2>
        <p className="mt-1.5 text-sm text-[var(--ink-muted)]">{copy.body}</p>
        {reason === "no_data" && accountName ? (
          <p className="mt-2 text-xs text-[var(--ink-muted)]">
            {accountName} · last {days} days
          </p>
        ) : null}
        {reason === "error" && errorNote ? (
          <p className="mt-3 rounded-[10px] bg-[var(--bg)] px-3 py-2 text-left text-xs text-[var(--ink-muted)]">{errorNote}</p>
        ) : null}
        {syncing ? (
          // No reconnect CTA: this is a transient load, not a failure. AutoRefresh recovers it. A quiet
          // fallback link stays available in case a pull genuinely never completes.
          <a href="/api/connect/meta/authorize" className="mt-6 inline-block text-xs text-[var(--ink-muted)] underline underline-offset-2 hover:text-[var(--ink)]">
            Taking too long? Reconnect
          </a>
        ) : (
          <a
            href="/api/connect/meta/authorize"
            className="mt-6 inline-block rounded-full bg-[var(--ink)] px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            {reason === "not_connected" ? "Connect Meta" : "Reconnect / switch account"}
          </a>
        )}
      </div>
    </div>
  );
}
