"use client";

// Editable CreativeScore verdict weights (rulebook 5B.1 / 5E). What is edited here is a
// per-account override that actually drives server-side scoring: Apply writes the adbrain.weights
// cookie, which lib/app/cockpit-data.ts reads and threads into the verdict engine, then refreshes.
// The cookie is the store (readable here, sent to the server); it is only ever written when the
// weights are valid and sum to 1, so an unbalanced set can never reach scoring.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const COOKIE = "adbrain.weights";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const DEFAULT_WEIGHTS = {
  performance: 0.3,
  trend: 0.3,
  fatigue: 0.2,
  funnel: 0.2,
};

type Weights = typeof DEFAULT_WEIGHTS;

type WeightKey = keyof Weights;

const FIELDS: { key: WeightKey; label: string; hint: string }[] = [
  { key: "performance", label: "Performance", hint: "How far above/below the objective average on ROAS, CPA, CTR, ATC/LP" },
  { key: "trend", label: "Trend", hint: "Day-wise slope on ROAS, CTR, CPM, CPA, ATC/LP, frequency" },
  { key: "fatigue", label: "Fatigue", hint: "Inverse of the fatigue engine score, lower fatigue scores higher" },
  { key: "funnel", label: "Funnel", hint: "Whether LPV to ATC to checkout to purchase is improving or breaking" },
];

function readCookieWeights(): Weights {
  if (typeof document === "undefined") return DEFAULT_WEIGHTS;
  for (const part of document.cookie.split("; ")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i) === COOKIE) {
      try {
        const p = JSON.parse(decodeURIComponent(part.slice(i + 1)));
        return {
          performance: Number(p.performance) || 0,
          trend: Number(p.trend) || 0,
          fatigue: Number(p.fatigue) || 0,
          funnel: Number(p.funnel) || 0,
        };
      } catch {
        return DEFAULT_WEIGHTS;
      }
    }
  }
  return DEFAULT_WEIGHTS;
}

export function SettingsPanel() {
  const router = useRouter();
  // Seed from the cookie so the panel shows the override the server is actually using.
  const [weights, setWeights] = useState<Weights>(readCookieWeights);
  const [applied, setApplied] = useState(false);

  const sum = FIELDS.reduce((acc, f) => acc + (weights[f.key] || 0), 0);
  const balanced = Math.abs(sum - 1) < 0.005;

  function setField(key: WeightKey, value: string) {
    const n = Number(value);
    // Clamp to [0,1] so an out-of-range typo can never be saved.
    const clamped = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
    setWeights((prev) => ({ ...prev, [key]: clamped }));
    setApplied(false);
  }

  function apply() {
    if (!balanced) return;
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(weights))}; path=/; max-age=${MAX_AGE}`;
    setApplied(true);
    router.refresh();
  }

  function reset() {
    setWeights(DEFAULT_WEIGHTS);
    document.cookie = `${COOKIE}=; path=/; max-age=0`;
    setApplied(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="text-base font-normal">Verdict weights</div>
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={reset}>Reset to defaults</Button>
        </div>
        <div className="mb-5 text-[13px] text-muted-foreground">
          Source of truth is the Measurement Canon; these are per-account overrides.
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1.5 block text-[13px] font-medium">{f.label}</span>
              <Input
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={weights[f.key]}
                onChange={(e) => setField(f.key, e.target.value)}
                className="tabular-nums"
              />
              <span className="mt-1 block text-xs text-muted-foreground">{f.hint}</span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">
            Sum <span className="font-semibold tabular-nums text-foreground">{sum.toFixed(2)}</span>
          </span>
          <div className="flex items-center gap-3">
            {!balanced ? (
              <Badge variant="warning">Weights must add to 1.00 to apply</Badge>
            ) : applied ? (
              <span className="text-xs font-semibold text-[var(--good-ink)]">Applied — scores updated</span>
            ) : null}
            <Button type="button" size="sm" className="rounded-full" onClick={apply} disabled={!balanced}>Apply to scoring</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
