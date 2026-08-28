"use client";

// Editable CreativeScore verdict weights (rulebook 5B.1 / 5E). The Measurement
// Canon is the canonical source of truth; what is edited here is a per-account
// override, saved locally so a reload keeps the buyer's own numbers. Storage is
// wrapped in try/catch since localStorage can be unavailable (private mode,
// disabled storage) and a settings screen must never crash over that.

import { useEffect, useState } from "react";

const STORAGE_KEY = "adbrain.weights";

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

function loadWeights(): Weights {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WEIGHTS;
    const parsed = JSON.parse(raw);
    return {
      performance: Number(parsed.performance) || 0,
      trend: Number(parsed.trend) || 0,
      fatigue: Number(parsed.fatigue) || 0,
      funnel: Number(parsed.funnel) || 0,
    };
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

function saveWeights(weights: Weights) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  } catch {
    // Storage unavailable, nothing to do, the values still hold for this session.
  }
}

export function SettingsPanel() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setWeights(loadWeights());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveWeights(weights);
  }, [weights, loaded]);

  const sum = FIELDS.reduce((acc, f) => acc + (weights[f.key] || 0), 0);
  const balanced = Math.abs(sum - 1) < 0.005;

  function setField(key: WeightKey, value: string) {
    const n = Number(value);
    setWeights((prev) => ({ ...prev, [key]: Number.isFinite(n) ? n : 0 }));
  }

  function reset() {
    setWeights(DEFAULT_WEIGHTS);
  }

  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="text-base font-semibold">Verdict weights</div>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-[var(--hairline)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-alt)]"
        >
          Reset to defaults
        </button>
      </div>
      <div className="mb-5 text-[13px] text-[var(--ink-muted)]">
        Source of truth is the Measurement Canon; these are per-account overrides.
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[var(--ink)]">{f.label}</span>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={weights[f.key]}
              onChange={(e) => setField(f.key, e.target.value)}
              className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-sm tabular-nums text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
            />
            <span className="mt-1 block text-xs text-[var(--ink-muted)]">{f.hint}</span>
          </label>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--surface-alt)] pt-4">
        <span className="text-sm text-[var(--ink-muted)]">
          Sum <span className="font-semibold tabular-nums text-[var(--ink)]">{sum.toFixed(2)}</span>
        </span>
        {!balanced && (
          <span className="rounded-full bg-[var(--warn-bg)] px-3 py-1 text-xs font-semibold text-[var(--warn-ink)]">
            Weights do not add to 1.00
          </span>
        )}
      </div>
    </div>
  );
}
