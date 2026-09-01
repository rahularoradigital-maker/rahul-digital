"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANS, ACTION_TOKENS, estimateTokens, recommendPlanId } from "@/lib/billing/plans";

// Pricing Phase 4 — "which plan fits me?" estimator. Deterministic, pure math shared with the meter
// (estimateTokens/recommendPlanId in lib/billing/plans.ts), so the estimate can never disagree with billing.
// No private data, no network.

const IMG = ACTION_TOKENS.image; // 20
const CHAT = ACTION_TOKENS.chat; // 1
const COPY = ACTION_TOKENS.concept; // 2

function Field({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[14px] font-medium text-[var(--ink)]">{label}</span>
      <span className="text-[12px] text-[var(--ink-muted)]">{hint}</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="mt-1 w-full rounded-[8px] border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-[15px] tabular-nums outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

export function PricingEstimator() {
  const [images, setImages] = useState(0);
  const [chats, setChats] = useState(0);
  const [copies, setCopies] = useState(0);

  const tokens = estimateTokens(images, chats, copies);
  const planId = recommendPlanId(tokens, images);
  const planLabel = PLANS[planId].label;
  const isFree = planId === "free";
  const note = isFree
    ? "Your usage fits the free plan (no image generation)."
    : tokens > PLANS.scale.tokens
      ? "Above the standard plans - start on Scale and talk to us about higher volume."
      : `Covers ~${tokens.toLocaleString("en-US")} tokens/month with room to spare.`;

  return (
    <div className="mx-auto max-w-3xl rounded-[16px] border border-[var(--hairline)] bg-[var(--surface)] p-6 sm:p-8">
      <div className="text-center">
        <h2 className="text-[26px] leading-tight">Which plan fits you?</h2>
        <p className="mt-2 text-[14px] text-[var(--ink-muted)]">
          Decisions are unlimited on every plan. Estimate only the AI extras you expect each month.
        </p>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        <Field label="AI images / month" hint={`${IMG} tokens each`} value={images} onChange={setImages} />
        <Field label="Chat questions / month" hint={`${CHAT} token each`} value={chats} onChange={setChats} />
        <Field label="Ad-copy sets / month" hint={`${COPY} tokens each`} value={copies} onChange={setCopies} />
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 rounded-[12px] bg-[var(--bg)] px-5 py-5 text-center">
        <span className="text-[12px] uppercase tracking-wide text-[var(--ink-muted)]">Estimated usage</span>
        <span className="text-[28px] font-semibold tabular-nums">{tokens.toLocaleString("en-US")} tokens/mo</span>
        <span className="mt-1 text-[15px]">
          Recommended: <span className="font-semibold text-[var(--accent)]">{planLabel}</span>
        </span>
        <span className="text-[13px] text-[var(--ink-muted)]">{note}</span>
        <Link
          href={isFree ? "/signup" : "/book-demo"}
          className="mt-3 inline-flex items-center justify-center rounded-full bg-[var(--ink)] px-5 py-2.5 text-[15px] font-medium text-white transition hover:opacity-90"
        >
          {isFree ? "Start free" : `Get started with ${planLabel}`}
        </Link>
      </div>
    </div>
  );
}
