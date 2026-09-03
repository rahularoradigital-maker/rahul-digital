"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilterPopover } from "./filter-popover";
import { Button } from "@/components/ui/button";

// Platform selector: view Facebook/Instagram (Meta) only, Google Ads only, or Both combined. Meta and Google
// are kept as SEPARATE sources for now (merged later); this scopes which platform's numbers the dashboard
// reflects. Stored in the "adbrain.platform" cookie which resolveCockpitScope reads server-side, then a
// refresh re-scopes every page. Default = meta. Open/keyboard/focus behaviour lives in <FilterPopover>.
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
  const [choice, setChoice] = useState<PlatformChoice>("meta");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const raw = readCookie("adbrain.platform");
    setChoice(raw === "google" || raw === "both" ? raw : "meta");
  }, []);

  function choose(next: PlatformChoice, close: () => void) {
    setChoice(next);
    close();
    // Only non-default values need a cookie; clearing back to "meta" keeps the default key shape.
    document.cookie = `adbrain.platform=${next}; path=/; max-age=${next === "meta" ? 0 : 60 * 60 * 24 * 30}`;
    startTransition(() => router.refresh());
  }

  const short = OPTIONS.find((o) => o.key === choice)?.short ?? "Meta";

  return (
    <FilterPopover label="Platform" summary={short} pending={pending} dialogLabel="Choose platform" width="w-60">
      {(close) =>
        OPTIONS.map((o) => (
          <Button
            key={o.key}
            type="button"
            variant="ghost"
            aria-pressed={choice === o.key}
            onClick={() => choose(o.key, close)}
            className={`w-full justify-start rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${choice === o.key ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
          >
            {o.label}
          </Button>
        ))
      }
    </FilterPopover>
  );
}
