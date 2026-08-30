"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { titleFor } from "@/lib/app/nav";
import { BrandSwitcher } from "@/components/app/brand-switcher";
import { WindowSwitcher } from "@/components/app/window-switcher";
import { CampaignSwitcher } from "@/components/app/campaign-switcher";
import { ObjectiveSwitcher } from "@/components/app/objective-switcher";
import { CatalogSwitcher } from "@/components/app/catalog-switcher";
import { NotificationBell } from "@/components/app/notification-bell";
import { FILTER_TRIGGER, FILTER_LABEL } from "@/components/app/control-styles";
import { rescanCockpit } from "@/app/app/actions";

// The working topbar. Every control does its job:
//  - date window  -> sets the adbrain.window cookie and re-scopes the whole page
//  - Re-scan      -> router.refresh() re-pulls live Meta data on the server
//  - Switch acct  -> re-runs Meta OAuth so the user can connect/switch account
//  - Ask          -> honest: acknowledges until the AI answer engine is wired
// Starter questions shown when the Ask box is focused and empty, so a first-time user knows what
// it can answer. Each maps to something real the grounded snapshot can answer from.
const ASK_SUGGESTIONS = [
  "Which ad is wasting the most budget?",
  "What should I scale this week?",
  "Which creatives are fatiguing?",
  "How is my account health and why?",
];

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ask, setAsk] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [focused, setFocused] = useState(false);

  // Shared by the form submit AND the suggestion chips, so both go through one grounded call.
  async function runAsk(raw: string) {
    const q = raw.trim();
    if (!q || asking) return;
    setAsk(q);
    setFocused(false);
    setAsking(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
      const d = (await res.json()) as { answer?: string; error?: string };
      setAnswer(d.answer ?? d.error ?? "No answer.");
    } catch {
      setAnswer("Ask failed. Please try again.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="px-4 py-3 sm:px-6">
      {/* Tier 1 - page identity + the primary action, always on one clean line. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight">{titleFor(pathname)}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Ask AdBrain: answers grounded in your real cockpit data (Gemini, no fabrication). */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAsk(ask);
            }}
            className="relative hidden items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-2 text-[var(--ink-muted)] transition focus-within:border-[var(--accent)] lg:flex"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3-3" />
            </svg>
            <input
              name="q"
              value={ask}
              placeholder="Ask AdBrain"
              aria-label="Ask AdBrain"
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              onChange={(e) => {
                setAsk(e.target.value);
                if (answer) setAnswer(null);
              }}
              className="w-44 bg-transparent text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
            />
            {/* Starter questions: shown only when focused, empty, and not mid-answer. */}
            {focused && !ask.trim() && !answer && !asking && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-96 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2 text-left shadow-lg">
                <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">Try asking</div>
                {ASK_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault(); // fire before the input's onBlur hides this panel
                      runAsk(s);
                    }}
                    className="block w-full rounded-md px-2 py-2 text-left text-[13px] text-[var(--ink)] transition hover:bg-[var(--surface-alt)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {(asking || answer) && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 max-h-96 w-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-3 text-left text-[13px] leading-relaxed text-[var(--ink)] shadow-lg">
                {asking ? "Thinking..." : answer}
              </div>
            )}
          </form>

          <NotificationBell />

          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await rescanCockpit();
                router.refresh();
              })
            }
            disabled={pending}
            className="rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Scanning..." : "Re-scan"}
          </button>
        </div>
      </div>

      {/* Tier 2 - scope filters, a calm toolbar under a hairline. Wraps cleanly on narrow screens. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--hairline)] pt-3">
        <BrandSwitcher />
        {/* Window selects the DISPLAY range (7/14/30/60/90 + custom). Fatigue/trend/scaling stay on the
            fixed 90-day baseline regardless (enforced in the store), so switching is instant + no re-pull. */}
        <WindowSwitcher />
        <ObjectiveSwitcher />
        <CatalogSwitcher />
        <CampaignSwitcher />
      </div>
    </div>
  );
}
