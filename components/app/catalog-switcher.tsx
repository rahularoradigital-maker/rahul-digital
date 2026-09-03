"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilterPopover } from "./filter-popover";
import { Button } from "@/components/ui/button";

// Catalog include/exclude filter: drop dynamic-product (catalog) ads from the analyzed set so the
// conversion/sale view reflects only non-catalog ads. Stored in the "adbrain.catalog" cookie which
// resolveCockpitScope reads server-side, then a refresh re-scopes every page. Default = include.
// Open/keyboard/focus behaviour lives in <FilterPopover>.
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
  const [mode, setMode] = useState<"include" | "exclude">("include");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMode(readCookie("adbrain.catalog") === "exclude" ? "exclude" : "include");
  }, []);

  function choose(next: "include" | "exclude", close: () => void) {
    setMode(next);
    close();
    // Only "exclude" needs a cookie; clearing back to the default keeps the key shape users already have.
    document.cookie = `adbrain.catalog=${next}; path=/; max-age=${next === "exclude" ? 60 * 60 * 24 * 30 : 0}`;
    startTransition(() => router.refresh());
  }

  const summary = mode === "exclude" ? "Excluded" : "Included";

  return (
    <FilterPopover label="Catalog" summary={summary} pending={pending} dialogLabel="Include or exclude catalog ads">
      {(close) =>
        OPTIONS.map((o) => (
          <Button
            key={o.key}
            type="button"
            variant="ghost"
            aria-pressed={mode === o.key}
            onClick={() => choose(o.key, close)}
            className={`w-full justify-start rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${mode === o.key ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
          >
            {o.label}
          </Button>
        ))
      }
    </FilterPopover>
  );
}
