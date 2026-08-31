"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Triggers a real discovery run for the active account, then refreshes the page to show the stored results.
// Honest: shows the server's error message verbatim (no key / no brand / out of credits / no results) and
// never leaves the user guessing. Discovery is slow (search + profile pulls), so the button stays disabled
// with a clear "Hunting..." state until it returns.
export function RunButton({ label, hunting }: { label: string; hunting: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/influencer/run", { method: "POST" });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!d.ok) {
        setError(d.error ?? "Discovery failed.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Discovery failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={run}
        disabled={disabled}
        className="inline-flex w-fit items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-[13.5px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {disabled ? hunting : label}
      </button>
      {error ? (
        <div className="rounded-lg border border-[var(--warn-ink)]/25 bg-[var(--warn-bg)] px-3 py-2 text-[12.5px] text-[var(--warn-ink)]">{error}</div>
      ) : null}
    </div>
  );
}
