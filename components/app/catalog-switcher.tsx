"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";
import { Button } from "@/components/ui/button";

// Catalog include/exclude filter: drop dynamic-product (catalog) ads from the analyzed set so the
// conversion/sale view reflects only non-catalog ads. Stored in the "adbrain.catalog" cookie which
// resolveCockpitScope reads server-side, then a refresh re-scopes every page. Default = include
// (current behavior). Same dropdown + cookie-write + router.refresh pattern as the objective switcher.
const OPTIONS: { key: "include" | "exclude"; label: string }[] = [
  { key: "include", label: "Include catalog" },
  { key: "exclude", label: "Exclude catalog" },
];

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  for (const part of document.cookie.split("; ")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return "";
}

export function CatalogSwitcher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"include" | "exclude">("include");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(readCookie("adbrain.catalog") === "exclude" ? "exclude" : "include");
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

  function choose(next: "include" | "exclude") {
    setMode(next);
    setOpen(false);
    // Only "exclude" needs a cookie; clearing back to the default keeps the key shape users already have.
    document.cookie = `adbrain.catalog=${next}; path=/; max-age=${next === "exclude" ? 60 * 60 * 24 * 30 : 0}`;
    startTransition(() => router.refresh());
  }

  const label = mode === "exclude" ? "Excluded" : "Included";

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={FILTER_TRIGGER}
      >
        {pending ? (
          <span className="flex items-center gap-1.5 text-[var(--accent)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
            Updating...
          </span>
        ) : (
          <>
            <span className={FILTER_LABEL}>Catalog</span> <span className="max-w-[150px] truncate">{label}</span>
          </>
        )}
        <span className={FILTER_LABEL}>▾</span>
      </Button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-56 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-lg">
          {OPTIONS.map((o) => (
            <Button
              key={o.key}
              type="button"
              variant="ghost"
              onClick={() => choose(o.key)}
              className={`w-full justify-start rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${mode === o.key ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
            >
              {o.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
