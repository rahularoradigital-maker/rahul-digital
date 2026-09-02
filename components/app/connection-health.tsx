import { Button } from "@/components/ui/button";
import type { ConnectionHealth } from "@/lib/connection/health";

// Presentational connection-health block for Settings. Surfaces what ad_sync_state already knew but never
// showed: data freshness, the last sync error (honest, as captured), rows, and - when the connection is
// broken or disconnected - a distinct Reconnect action (not just "Switch account"). Pure props in, no I/O.

const DOT: Record<ConnectionHealth["tone"], string> = {
  good: "var(--good-ink)",
  warn: "var(--warn-ink)",
  bad: "var(--bad-ink)",
};

export function ConnectionHealthCard({ health }: { health: ConnectionHealth }) {
  const { tone, headline, rows, lastSyncedLabel, error, needsReconnect, status } = health;
  if (status === "disconnected") return null; // the parent already shows the "connect" CTA in that case

  return (
    <div className="mt-4 border-t border-[var(--hairline)] pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: DOT[tone] }} />
            <span className="font-medium text-[var(--ink)]">Data sync</span>
          </div>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">{headline}</p>
          {rows != null && lastSyncedLabel ? (
            <p className="mt-0.5 text-[12px] text-[var(--ink-muted)]">
              {rows.toLocaleString("en-IN")} ad{rows === 1 ? "" : "s"} in the last sync.
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 rounded-[8px] px-2.5 py-1.5 text-[12px]" style={{ background: "var(--bad-bg)", color: "var(--bad-ink)" }}>
              Last error: {error}
            </p>
          ) : null}
        </div>
        {needsReconnect ? (
          <Button asChild className="rounded-full">
            <a href="/api/connect/meta/authorize">Reconnect</a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
