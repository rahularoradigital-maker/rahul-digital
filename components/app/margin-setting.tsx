"use client";

// Gross-margin % setting (P1). One typed number that turns platform ROAS into margin-aware economics
// (contribution-margin ROAS, contribution profit, implied COGS) across the app. Same cookie-store pattern as
// the CreativeScore weights panel: Apply writes adbrain.margin, the server reads it and computes; no DB needed.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COOKIE = "adbrain.margin";
const MAX_AGE = 60 * 60 * 24 * 365; // a year - an economic constant, not a per-session filter

function readCookieMargin(): string {
  if (typeof document === "undefined") return "";
  for (const part of document.cookie.split("; ")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === COOKIE) return decodeURIComponent(part.slice(i + 1));
  }
  return "";
}

export function MarginSetting() {
  const router = useRouter();
  const [value, setValue] = useState<string>(() => readCookieMargin());
  const [saved, setSaved] = useState(false);

  const n = Number(value);
  const valid = Number.isFinite(n) && n > 0 && n < 100;

  function apply() {
    if (!valid) return;
    document.cookie = `${COOKIE}=${encodeURIComponent(String(n))}; path=/; max-age=${MAX_AGE}`;
    setSaved(true);
    router.refresh();
  }
  function clear() {
    document.cookie = `${COOKIE}=; path=/; max-age=0`;
    setValue("");
    setSaved(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-1 text-base font-normal">Gross margin</div>
        <p className="mb-3 max-w-xl text-sm text-[var(--ink-muted)]">
          Your blended gross margin % (revenue minus product cost, before ad spend). Set this once and the app shows
          margin-aware economics - contribution-margin ROAS, contribution profit and implied COGS - instead of raw
          platform ROAS. It never leaves your browser cookie; nothing is sent anywhere new.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={99} value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }} placeholder="e.g. 60" className="w-28" />
            <span className="text-sm text-[var(--ink-muted)]">%</span>
          </div>
          <Button onClick={apply} disabled={!valid} className="rounded-full">Apply</Button>
          {readCookieMargin() && <Button onClick={clear} variant="outline" className="rounded-full">Clear</Button>}
          {saved && <span className="text-[13px] text-[var(--good-ink)]">Saved - economics updated.</span>}
          {!valid && value !== "" && <span className="text-[13px] text-[var(--bad-ink)]">Enter a number between 1 and 99.</span>}
        </div>
      </CardContent>
    </Card>
  );
}
