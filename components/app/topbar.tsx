"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { titleFor } from "@/lib/app/nav";
import { WINDOWS } from "@/lib/app/windows";
import { AccountSwitcher } from "@/components/app/account-switcher";
import { CampaignSwitcher } from "@/components/app/campaign-switcher";
import { ObjectiveSwitcher } from "@/components/app/objective-switcher";
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
        <AccountSwitcher />
        <DateWindow onChange={() => startTransition(() => router.refresh())} />
        <ObjectiveSwitcher />
        <CampaignSwitcher />
      </div>
    </div>
  );
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  for (const part of document.cookie.split("; ")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return "";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Date-window control. A preset writes "days:<n>"; a custom range writes
// "range:<from>:<to>" into the adbrain.window cookie, which loadCockpit reads server-side.
// Same dropdown + click-outside pattern as the objective/campaign switchers.
function DateWindow({ onChange }: { onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [label, setLabel] = useState("Last 14 days");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayISO());
  const ref = useRef<HTMLDivElement>(null);

  // Seed the label (and the custom inputs) from the cookie so the control reflects the
  // window that is actually in effect on load.
  useEffect(() => {
    const raw = readCookie("adbrain.window");
    if (raw.startsWith("days:")) {
      const n = Number(raw.slice(5));
      if (Number.isFinite(n) && n > 0) setLabel(`Last ${n} days`);
    } else if (raw.startsWith("range:")) {
      const [s, u] = raw.slice(6).split(":");
      if (s && u) {
        setLabel(`${s} to ${u}`);
        setFrom(s);
        setTo(u);
      }
    }
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function write(value: string) {
    document.cookie = `adbrain.window=${value}; path=/; max-age=${60 * 60 * 24 * 30}`;
    setOpen(false);
    setShowCustom(false);
    onChange();
  }

  function choosePreset(n: number) {
    setLabel(`Last ${n} days`);
    write(`days:${n}`);
  }

  function applyRange() {
    if (!from || !to || from > to) return;
    setLabel(`${from} to ${to}`);
    write(`range:${from}:${to}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={FILTER_TRIGGER}
      >
        <span className={FILTER_LABEL}>Dates</span>
        <span className="max-w-[170px] truncate">{label}</span>
        <span className={FILTER_LABEL}>▾</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-60 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-lg">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => choosePreset(w)}
              className={`w-full rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${label === `Last ${w} days` ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
            >
              Last {w} days
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCustom((s) => !s)}
            className={`w-full rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${showCustom || label.includes(" to ") ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
          >
            Custom range
          </button>
          {showCustom ? (
            <div className="mt-1 flex flex-col gap-2 border-t border-[var(--hairline)] px-1 pt-2">
              <label className="flex flex-col gap-1 text-[11px] text-[var(--ink-muted)]">
                From
                <input
                  type="date"
                  value={from}
                  max={to || todayISO()}
                  onChange={(e) => setFrom(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  aria-label="From date"
                  className="rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-[var(--ink-muted)]">
                To
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  max={todayISO()}
                  onChange={(e) => setTo(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  aria-label="To date"
                  className="rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <button
                type="button"
                onClick={applyRange}
                disabled={!from || !to || from > to}
                className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-[13px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Apply range
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
