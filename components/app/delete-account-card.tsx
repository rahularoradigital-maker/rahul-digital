"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// S5 (deletion): the "Danger zone" control. A two-step confirm schedules a SOFT delete (14-day grace); a
// pending request shows the purge date + a Cancel. All it does is call /api/account/delete - the irreversible
// purge is the cron's job, so a mis-click is always recoverable within the grace.
export function DeleteAccountCard({ initialPurgeAfter, graceDays }: { initialPurgeAfter: string | null; graceDays: number }) {
  const [purgeAfter, setPurgeAfter] = useState<string | null>(initialPurgeAfter);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  async function schedule() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const j = (await res.json()) as { ok?: boolean; purgeAfter?: string; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Could not schedule deletion.");
      setPurgeAfter(j.purgeAfter ?? null);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not cancel.");
      setPurgeAfter(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-[var(--bad-ink)]/30">
      <CardContent className="p-6">
        <h2 className="text-[15px] font-semibold text-[var(--bad-ink)]">Delete account</h2>
        {purgeAfter ? (
          <div className="mt-2 space-y-3">
            <p className="text-[13px] text-[var(--ink)]">
              Your account is scheduled for permanent deletion on <span className="font-medium">{fmt(purgeAfter)}</span>. Meta access has been revoked. You can cancel any time before then.
            </p>
            <Button variant="outline" size="sm" onClick={cancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel deletion"}</Button>
          </div>
        ) : confirming ? (
          <div className="mt-2 space-y-3">
            <p className="text-[13px] text-[var(--ink)]">
              This permanently deletes your account and all analysis data after a {graceDays}-day grace period, and revokes Meta access now. This cannot be undone once the grace ends. Are you sure?
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={schedule} disabled={busy}>{busy ? "Scheduling…" : `Yes, delete my account`}</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>Keep my account</Button>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-[13px] text-[var(--ink-muted)]">
              Permanently delete your account and all data. We keep it for {graceDays} days first so you can change your mind, then it is erased for good.
            </p>
            <Button variant="outline" size="sm" className="border-[var(--bad-ink)]/40 text-[var(--bad-ink)] hover:bg-[var(--bad-bg)]" onClick={() => setConfirming(true)}>Delete account</Button>
          </div>
        )}
        {error ? <p className="mt-2 text-[13px] text-[var(--bad-ink)]">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
