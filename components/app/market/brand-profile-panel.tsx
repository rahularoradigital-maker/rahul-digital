"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Reviewable brand profile: auto-derived from the account's real ad data, shown here so the user
// can correct it before it drives competitor discovery. "Learn" derives (draft); the fields are
// editable; "Confirm" saves the reviewed version. Grounded - the server never invents.

export type EditableProfile = {
  category: string | null;
  subcategories: string[];
  keyProducts: string[];
  pricePositioning: string | null;
  targetMarket: string | null;
  brandVoice: string | null;
  summary: string | null;
  website: string | null;
  currency?: string | null;
  status?: "draft" | "confirmed";
};

const input =
  "w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]";

export function BrandProfilePanel({ initial }: { initial: EditableProfile | null }) {
  const router = useRouter();
  const [p, setP] = useState<EditableProfile | null>(initial);
  const [busy, setBusy] = useState<"derive" | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function call(payload: object | null): Promise<void> {
    setError(null);
    try {
      const res = await fetch("/api/brand/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      const d = (await res.json()) as { ok?: boolean; profile?: EditableProfile; error?: string };
      if (!res.ok || !d.ok || !d.profile) {
        setError(d.error ?? "Something went wrong. Please try again.");
        return;
      }
      setP(d.profile);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function derive() {
    setBusy("derive");
    setSaved(false);
    await call(null);
    setBusy(null);
  }
  async function confirm() {
    if (!p) return;
    setBusy("confirm");
    await call({ profile: p, currency: p.currency });
    setSaved(true);
    setBusy(null);
  }

  const set = (k: keyof EditableProfile, v: string) => setP((prev) => (prev ? { ...prev, [k]: v } : prev));
  const setList = (k: "subcategories" | "keyProducts", v: string) =>
    setP((prev) => (prev ? { ...prev, [k]: v.split(",").map((x) => x.trim()).filter(Boolean) } : prev));

  if (!p) {
    return (
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
        <h2 className="text-[22px] font-normal tracking-tight">Brand understanding</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">
          Learn this brand from its own live ads - category, products, price positioning, market and voice - to build the
          context that drives competitor discovery. Auto-derived from real data; nothing is invented, and you review it before
          it is used.
        </p>
        {error && <p className="mt-3 text-[13px] text-[var(--bad-ink)]">{error}</p>}
        <button
          type="button"
          onClick={derive}
          disabled={busy === "derive"}
          className="mt-4 rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {busy === "derive" ? "Learning from your ads..." : "Learn this brand"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px] font-normal tracking-tight">Brand understanding</h2>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${p.status === "confirmed" ? "bg-[var(--good-bg)] text-[var(--good-ink)]" : "bg-[var(--warn-bg)] text-[var(--warn-ink)]"}`}>
            {p.status === "confirmed" ? "Confirmed" : "Draft - review below"}
          </span>
        </div>
        <p className="mb-5 text-sm text-[var(--ink-muted)]">
          Auto-derived from your live ads{p.currency ? ` (${p.currency})` : ""}. Correct anything, then Confirm - the confirmed
          profile is what will drive competitor discovery.
        </p>

        {p.summary && (
          <div className="mb-5 rounded-[10px] border border-[var(--surface-alt)] bg-[var(--bg)] px-4 py-3 text-[13px] leading-relaxed text-[var(--ink)]">
            {p.summary}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Category"><input className={input} value={p.category ?? ""} onChange={(e) => set("category", e.target.value)} /></Field>
          <Field label="Target market"><input className={input} value={p.targetMarket ?? ""} onChange={(e) => set("targetMarket", e.target.value)} /></Field>
          <Field label="Price positioning"><input className={input} value={p.pricePositioning ?? ""} onChange={(e) => set("pricePositioning", e.target.value)} placeholder="value / mass premium / premium / luxury" /></Field>
          <Field label="Brand voice"><input className={input} value={p.brandVoice ?? ""} onChange={(e) => set("brandVoice", e.target.value)} /></Field>
          <Field label="Website"><input className={input} value={p.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="brand.com" /></Field>
          <Field label="Sub-categories (comma-separated)"><input className={input} value={p.subcategories.join(", ")} onChange={(e) => setList("subcategories", e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Key products (comma-separated)"><input className={input} value={p.keyProducts.join(", ")} onChange={(e) => setList("keyProducts", e.target.value)} /></Field>
          </div>
        </div>

        {error && <p className="mt-3 text-[13px] text-[var(--bad-ink)]">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--surface-alt)] pt-4">
          <button type="button" onClick={confirm} disabled={busy !== null} className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60">
            {busy === "confirm" ? "Saving..." : "Confirm profile"}
          </button>
          <button type="button" onClick={derive} disabled={busy !== null} className="rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-5 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)] disabled:opacity-60">
            {busy === "derive" ? "Re-learning..." : "Re-learn from ads"}
          </button>
          {saved && p.status === "confirmed" && <span className="text-[13px] font-semibold text-[var(--good-ink)]">Confirmed - ready to drive competitor discovery</span>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[var(--ink-muted)]">{label}</span>
      {children}
    </label>
  );
}
