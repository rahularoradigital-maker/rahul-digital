"use client";

import { useEffect, useState } from "react";

// Honest connect-result banner. The Meta connect + account-switch routes redirect failures to
// /app?connect=error (12 call sites) and ?connect=denied (1) - but nothing read that param, so a failed
// connect or account switch bounced the user to /app with NO explanation (a silent failure - exactly what
// the trust north-star forbids). This surfaces what happened + the one action that fixes it, then strips the
// param so a refresh doesn't re-show it. Mounted once in the app shell, alongside OfflineBanner.
//
// Reads window.location.search in an effect (client-only) rather than useSearchParams, so it needs no
// Suspense boundary and never affects prerendering. Renders nothing unless a known failure param is present.

type ConnectResult = "error" | "denied";

const COPY: Record<ConnectResult, { title: string; body: string; tone: "bad" | "warn" }> = {
  error: {
    title: "We couldn't finish that Meta action",
    body: "Your connection may have expired. Reconnect your Meta account and try again - nothing was changed.",
    tone: "bad",
  },
  denied: {
    title: "That ad account isn't reachable",
    body: "Your current Meta permissions don't cover it. Pick a different account from the switcher, or reconnect to grant access.",
    tone: "warn",
  },
};

export function ConnectResultBanner() {
  const [result, setResult] = useState<ConnectResult | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("connect");
    if (v === "error" || v === "denied") {
      setResult(v);
      // Strip the param so a manual refresh won't re-show the banner (keep it visible until dismissed).
      params.delete("connect");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  if (!result) return null;
  const { title, body, tone } = COPY[result];
  const bg = tone === "bad" ? "var(--bad-bg)" : "var(--warn-bg)";
  const ink = tone === "bad" ? "var(--bad-ink)" : "var(--warn-ink)";

  return (
    <div
      role="alert"
      className="mx-auto mb-4 flex w-full max-w-6xl items-start gap-3 rounded-[12px] px-4 py-3"
      style={{ background: bg, color: ink }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] opacity-90">{body}</p>
        <a href="/api/connect/meta/authorize" className="mt-2 inline-block text-[13px] font-medium underline underline-offset-2">
          Reconnect Meta
        </a>
      </div>
      <button
        type="button"
        onClick={() => setResult(null)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-1 text-lg leading-none opacity-70 transition hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
