"use client";

import { useState } from "react";

// Approve / dismiss a recommendation. The click posts the operator's judgment (the RLEF
// preference label) and confirms inline. Non-blocking: a failure just re-enables the buttons.
export function JudgmentButtons({ adId, timeWindow }: { adId: string; timeWindow: string }) {
  const [state, setState] = useState<"idle" | "sending" | "approve" | "dismiss" | "error">("idle");

  async function send(judgment: "approve" | "dismiss") {
    setState("sending");
    try {
      const res = await fetch("/api/audit/judgment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId, timeWindow, judgment }),
      });
      const data = (await res.json()) as { ok: boolean };
      // A failed save must not look like a silent no-op: show an error state so the operator knows
      // their judgment was NOT recorded and can retry.
      setState(data.ok ? judgment : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "approve" || state === "dismiss") {
    return (
      <span className={`text-[11px] font-semibold ${state === "approve" ? "text-[var(--good-ink)]" : "text-[var(--ink-muted)]"}`}>
        {state === "approve" ? "Approved" : "Dismissed"}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      {state === "error" && (
        <span className="text-[11px] font-semibold text-[var(--bad-ink)]">Not saved, retry</span>
      )}
      <button
        type="button"
        onClick={() => send("approve")}
        disabled={state === "sending"}
        className="rounded-full border border-[var(--hairline)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink)] transition hover:border-[var(--good-ink)] hover:text-[var(--good-ink)] disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => send("dismiss")}
        disabled={state === "sending"}
        className="rounded-full border border-[var(--hairline)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)] transition hover:border-[var(--bad-ink)] hover:text-[var(--bad-ink)] disabled:opacity-50"
      >
        Dismiss
      </button>
    </span>
  );
}
