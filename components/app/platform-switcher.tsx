"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";
import { Button } from "@/components/ui/button";

// Platform selector: view Facebook/Instagram (Meta) only, Google Ads only, or Both combined. Meta and Google
// are kept as SEPARATE sources for now (merged later); this scopes which platform's numbers the dashboard
// reflects. Stored in the "adbrain.platform" cookie which resolveCockpitScope reads server-side, then a
// refresh re-scopes every page. Default = meta (current behavior). Same dropdown + cookie + refresh pattern
// as the other topbar switchers.
type PlatformChoice = "meta" | "google" | "both";
const OPTIONS: { key: PlatformChoice; label: string; short: string }[] = [
  { key: "meta", label: "Facebook / Instagram", short: "Meta" },
  { key: "google", label: "Google Ads", short: "Google" },
  { key: "both", label: "Both (combined)", short: "Both" },
];

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  for (const part of document.cookie.split("; ")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return "";
}

export function PlatformSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<PlatformChoice>("meta");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raw = readCookie("adbrain.platform");
    setChoice(raw === "google" || raw === "both" ? raw : "meta");
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

  function choose(next: PlatformChoice) {
    setChoice(next);
    setOpen(false);
    // Only non-default values need a cookie; clearing back to "meta" keeps the default key shape.
    document.cookie = `adbrain.platform=${next}; path=/; max-age=${next === "meta" ? 0 : 60 * 60 * 24 * 30}`;
    startTransition(() => router.refresh());
  }

  const short = OPTIONS.find((o) => o.key === choice)?.short ?? "Meta";

  return (
    <div ref={ref} className="relative">
      <Button type="button" variant="outline" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} className={FILTER_TRIGGER}>
        {pending ? (
          <span className="flex items-center gap-1.5 text-[var(--accent)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
            Updating...
          </span>
        ) : (
          <>
            <span className={FILTER_LABEL}>Platform</span> <span className="max-w-[150px] truncate">{short}</span>
          </>
        )}
        <span className={FILTER_LABEL}>▾</span>
      </Button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-60 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-lg">
          {OPTIONS.map((o) => (
            <Button
              key={o.key}
              type="button"
              variant="ghost"
              onClick={() => choose(o.key)}
              className={`w-full justify-start rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${choice === o.key ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
            >
              {o.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
