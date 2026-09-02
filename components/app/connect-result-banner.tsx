"use client";

import { useEffect, useState } from "react";

// Honest result banner for the connect + brand flows. Several routes redirect to /app with a status query
// param to report what happened - but nothing read them, so failures (and successes) were silent: a user
// bounced back to /app with no idea their connect failed, their Meta login had no ad accounts, or a brand
// couldn't open. This reads those params, says what happened + the one action that fixes it, then strips the
// param so a refresh doesn't re-show it. Mounted once in the app shell.
//
// Signals covered (source routes):
//   connect=error       (12x) - connect/switch failed        -> reconnect
//   connect=denied      (1x)  - account not reachable         -> reconnect
//   connect=no_accounts (1x)  - Meta login has no ad accounts -> reconnect
//   connect=ok          (1x)  - connected                     -> positive, auto-dismisses
//   brand=empty         (1x)  - brand has no connected account-> go to Brand
//   brand=denied        (1x)  - no access to that brand       -> (no action)
//
// Reads window.location.search in an effect (client-only) - no Suspense boundary, no prerender impact.

type Tone = "bad" | "warn" | "good";
type Entry = { title: string; body: string; tone: Tone; cta?: { label: string; href: string } };

const RECONNECT = { label: "Reconnect Meta", href: "/api/connect/meta/authorize" };

// Keyed "<param>:<value>". Only these known signals render; anything else is ignored.
const COPY: Record<string, Entry> = {
  "connect:error": {
    title: "We couldn't finish that Meta action",
    body: "Your connection may have expired. Reconnect your Meta account and try again - nothing was changed.",
    tone: "bad",
    cta: RECONNECT,
  },
  "connect:denied": {
    title: "That ad account isn't reachable",
    body: "Your current Meta permissions don't cover it. Pick a different account from the switcher, or reconnect to grant access.",
    tone: "warn",
    cta: RECONNECT,
  },
  "connect:no_accounts": {
    title: "No ad accounts on that Meta login",
    body: "Sign-in worked, but this Meta login has no ad accounts we can access. Add or get access to an ad account in Meta Business, then reconnect.",
    tone: "warn",
    cta: RECONNECT,
  },
  "connect:ok": {
    title: "Meta connected",
    body: "Your ad data is syncing now - your dashboard will fill in shortly.",
    tone: "good",
  },
  "brand:empty": {
    title: "Couldn't open that brand",
    body: "It doesn't have a connected ad account yet. Connect one, then try again.",
    tone: "warn",
    cta: { label: "Go to Brand", href: "/app/market?tab=brand" },
  },
  "brand:denied": {
    title: "No access to that brand",
    body: "You don't have permission to view it. Ask an admin to share it with you.",
    tone: "bad",
  },
};

// Which param wins if more than one is present: connect before brand (connect is the higher-stakes flow).
const PARAMS = ["connect", "brand"] as const;

export function ConnectResultBanner() {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let matched: string | null = null;
    for (const p of PARAMS) {
      const v = params.get(p);
      if (v && COPY[`${p}:${v}`]) {
        if (!matched) matched = `${p}:${v}`;
      }
      if (v) params.delete(p); // strip every known family param so a refresh won't re-show
    }
    if (matched) {
      setKey(matched);
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  // Success is a transient confirmation, not a standing alert - fade it on its own so it doesn't nag.
  useEffect(() => {
    if (key && COPY[key].tone === "good") {
      const t = setTimeout(() => setKey(null), 6000);
      return () => clearTimeout(t);
    }
  }, [key]);

  if (!key) return null;
  const { title, body, tone, cta } = COPY[key];
  const bg = tone === "bad" ? "var(--bad-bg)" : tone === "warn" ? "var(--warn-bg)" : "var(--good-bg)";
  const ink = tone === "bad" ? "var(--bad-ink)" : tone === "warn" ? "var(--warn-ink)" : "var(--good-ink)";

  return (
    <div
      role={tone === "good" ? "status" : "alert"}
      className="mx-auto mb-4 flex w-full max-w-6xl items-start gap-3 rounded-[12px] px-4 py-3"
      style={{ background: bg, color: ink }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] opacity-90">{body}</p>
        {cta ? (
          <a href={cta.href} className="mt-2 inline-block text-[13px] font-medium underline underline-offset-2">
            {cta.label}
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setKey(null)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-1 text-lg leading-none opacity-70 transition hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
