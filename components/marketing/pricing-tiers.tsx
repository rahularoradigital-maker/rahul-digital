"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

// Phase 1 pricing tiers (static, no billing yet - CTAs go to sign-up / book-a-demo). Two toggles: currency
// (INR default for an India-heavy audience, USD available) and billing period (annual default - research shows
// defaulting to annual lifts revenue-per-customer). Token counts are the differentiator; every tier shows the
// plain-English "~N analyses" translation so a "token" is never opaque. INR is an approximate conversion of the
// canonical USD price (shown with "approx"); it is not a separate price list.

type Money = { usd: number; inr: number };
type Tier = {
  name: string;
  tagline: string;
  monthly: Money; // per-month, monthly billing
  annual: Money | null; // per-month, billed annually (null for Free)
  annualBilledUsd: number | null;
  tokens: number;
  sub: string; // what the tokens buy (decisions are unlimited; tokens = AI chat 1 / ad copy 2 / image ~20)
  popular?: boolean;
  cta: { label: string; href: string };
  features: string[];
  footnote?: string;
};

const TIERS: Tier[] = [
  {
    name: "Free",
    tagline: "See it work on your own account",
    monthly: { usd: 0, inr: 0 },
    annual: null,
    annualBilledUsd: null,
    tokens: 50,
    sub: "for AI chat & ad copy",
    cta: { label: "Start free", href: "/signup" },
    features: ["Unlimited scale / refresh / kill decisions", "1 ad account", "A reason for every call", "No image generation"],
    footnote: "No card required. Image generation needs a paid plan.",
  },
  {
    name: "Starter",
    tagline: "For a solo advertiser or small brand",
    monthly: { usd: 99, inr: 8300 },
    annual: { usd: 82, inr: 6900 },
    annualBilledUsd: 990,
    tokens: 1500,
    sub: "for AI chat, copy & images",
    cta: { label: "Get started", href: "/book-demo" },
    features: ["Unlimited scale / refresh / kill decisions", "Meta + Google ad accounts", "AI chat, copy & image generation", "Multiple ad accounts"],
  },
  {
    name: "Growth",
    tagline: "For scaling brands and small agencies",
    monthly: { usd: 399, inr: 33400 },
    annual: { usd: 332, inr: 27900 },
    annualBilledUsd: 3990,
    tokens: 7500,
    sub: "for AI chat, copy & images",
    popular: true,
    cta: { label: "Get started", href: "/book-demo" },
    features: ["Unlimited scale / refresh / kill decisions", "Meta + Google ad accounts", "AI chat, copy & image generation", "Multiple ad accounts"],
  },
  {
    name: "Scale",
    tagline: "For agencies and high-spend accounts",
    monthly: { usd: 999, inr: 83700 },
    annual: { usd: 832, inr: 69900 },
    annualBilledUsd: 9990,
    tokens: 25000,
    sub: "for AI chat, copy & images",
    cta: { label: "Talk to sales", href: "/book-demo" },
    features: ["Unlimited scale / refresh / kill decisions", "Meta + Google ad accounts", "AI chat, copy & image generation", "Multiple ad accounts"],
  },
];

function fmt(cur: "inr" | "usd", n: number): string {
  if (n === 0) return cur === "inr" ? "₹0" : "$0";
  return cur === "inr" ? `₹${n.toLocaleString("en-IN")}` : `$${n.toLocaleString("en-US")}`;
}

export function PricingTiers() {
  const [cur, setCur] = useState<"inr" | "usd">("inr");
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      {/* Toggles */}
      <div className="flex flex-col items-center gap-4">
        <div className="inline-flex items-center rounded-full border border-[var(--hairline)] bg-[var(--surface)] p-1 text-[14px]">
          <button
            onClick={() => setAnnual(true)}
            className={`rounded-full px-4 py-1.5 font-medium transition ${annual ? "bg-[var(--ink)] text-white" : "text-[var(--ink-muted)]"}`}
          >
            Annual <span className={annual ? "text-white/70" : "text-[var(--accent)]"}>· 2 months free</span>
          </button>
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 font-medium transition ${!annual ? "bg-[var(--ink)] text-white" : "text-[var(--ink-muted)]"}`}
          >
            Monthly
          </button>
        </div>
        <div className="inline-flex items-center rounded-full border border-[var(--hairline)] p-0.5 text-[13px]">
          <button onClick={() => setCur("inr")} className={`rounded-full px-3 py-1 transition ${cur === "inr" ? "bg-[var(--surface)] font-medium text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}>
            ₹ INR
          </button>
          <button onClick={() => setCur("usd")} className={`rounded-full px-3 py-1 transition ${cur === "usd" ? "bg-[var(--surface)] font-medium text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}>
            $ USD
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div className="mt-12 grid gap-6 lg:grid-cols-4">
        {TIERS.map((t) => {
          const price = annual && t.annual ? t.annual : t.monthly;
          const isFree = t.monthly.usd === 0;
          return (
            <div
              key={t.name}
              className={`relative flex flex-col rounded-[16px] border bg-[var(--bg)] p-6 ${
                t.popular ? "border-[var(--accent)] shadow-[0_8px_30px_rgba(37,99,235,0.10)]" : "border-[var(--hairline)]"
              }`}
            >
              {t.popular && (
                <Badge className="absolute -top-3 left-6 rounded-full bg-[var(--accent)] px-3 py-1 text-[12px] font-semibold text-white">
                  Most popular
                </Badge>
              )}
              <h3 className="text-[20px] font-semibold">{t.name}</h3>
              <p className="mt-1 min-h-[40px] text-[13px] text-[var(--ink-muted)]">{t.tagline}</p>

              <div className="mt-4">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[34px] font-semibold tracking-tight">{fmt(cur, price[cur])}</span>
                  {!isFree && <span className="text-[14px] text-[var(--ink-muted)]">/mo</span>}
                </div>
                <p className="mt-1 text-[12px] text-[var(--ink-muted)]">
                  {isFree
                    ? "Free forever"
                    : annual
                      ? `Billed annually${cur === "usd" && t.annualBilledUsd ? ` (${fmt("usd", t.annualBilledUsd)}/yr)` : ""}`
                      : "Billed monthly"}
                  {cur === "inr" && !isFree ? " · approx" : ""}
                </p>
              </div>

              <div className="mt-5 rounded-[10px] bg-[var(--surface)] px-4 py-3">
                <div className="text-[15px] font-semibold text-[var(--ink)]">{t.tokens.toLocaleString("en-US")} tokens/mo</div>
                <div className="text-[12px] text-[var(--ink-muted)]">{t.sub}</div>
              </div>

              <Link
                href={t.cta.href}
                className={`mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[15px] font-medium transition ${
                  t.popular ? "bg-[var(--accent)] text-white hover:opacity-90" : "bg-[var(--ink)] text-white hover:opacity-90"
                }`}
              >
                {t.cta.label}
              </Link>

              <ul className="mt-6 flex flex-col gap-2.5 text-[14px]">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[var(--ink)]">
                    <span aria-hidden className="mt-0.5 text-[var(--accent)]">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {t.footnote && <p className="mt-4 text-[11px] leading-relaxed text-[var(--ink-muted)]">{t.footnote}</p>}
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-[12px] text-[var(--ink-muted)]">
        Every plan includes unlimited scale, refresh, and kill decisions, with a reason for each. Tokens are used
        only for the AI extras - a chat answer is 1 token, ad copy 2 tokens, an AI image about 20. Rupee prices are
        an approximate conversion of the US dollar price, and AdScale never edits or spends on your account.
      </p>
    </div>
  );
}
