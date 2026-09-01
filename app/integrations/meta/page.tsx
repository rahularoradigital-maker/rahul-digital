import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahul-digital.vercel.app";
const TITLE = "Meta Ads integration for AdScale";
const DESCRIPTION =
  "Connect your Meta ad account (read-only) and AdScale reads your day-wise performance and tells you what to scale, refresh, or kill, with a reason for every call. It never changes your account.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/integrations/meta" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/integrations/meta`, siteName: "AdScale AI" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// What AdScale actually does with Meta data. Every line is a real, shipped capability (no invented metrics,
// no fabricated results) - matches the honesty rules and the growth knowledge base.
const DECISIONS: { h: string; d: string }[] = [
  { h: "A verdict on every ad, with the reason", d: "Scale, refresh, or kill, each carrying a triple-labelled read: is it judgeable at all, do the signals agree, and how sure. Never a black-box call." },
  { h: "Objective, ROAS and trend on every action", d: "Each recommended action shows the campaign objective, the current ROAS, and whether the objective's own results are trending up or down." },
  { h: "Buyer-grade rigor before any call", d: "No fatigue or kill verdict on an ad that spent too little of its ad set to be judged. Statistical sufficiency and materiality come first." },
  { h: "Ranked by money at stake", d: "What to do today, ordered by the rupees on the line, and only on ads that are actually delivering, never a paused or dead entity." },
  { h: "Ad set and campaign at their own metrics", d: "Reach, frequency and budget read natively at each level, not naive roll-ups, so money figures trace to a real campaign and ad set." },
  { h: "Creative fatigue, caught early", d: "Day-wise frequency, engagement and cost read together against each ad's own baseline, so wear is flagged before cost per result doubles." },
];

const DATA_POINTS = ["Spend", "Impressions", "Clicks", "Purchases", "Revenue", "Frequency", "Thumb-stop rate", "Hold rate", "Landing page views", "Add-to-cart", "Checkout", "Day-wise history"];

export default function MetaIntegrationPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="bg-[var(--accent)] px-4 py-2 text-center text-sm text-white">
        Meta-first creative and media intelligence. Google Ads next.
      </div>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 pt-20 pb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-1.5 text-sm text-[var(--ink-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            Meta Ads integration
          </span>
          <h1 className="mx-auto mt-6 max-w-2xl text-4xl leading-[1.06] tracking-tight sm:text-5xl">
            Your Meta account, read as a weekly decision.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--ink-muted)]">
            Connect read-only. AdScale reads your day-wise performance and tells you what to scale, refresh, or kill, with a reason for every call.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/book-demo" className="inline-block rounded-full bg-[var(--ink)] px-7 py-3 font-medium text-white transition hover:opacity-90">
              Book a demo
            </Link>
            <a href="#how" className="text-[15px] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]">
              See how it works
            </a>
          </div>
        </section>

        {/* What connects - three steps, hairline-separated (not cards) */}
        <section id="how" className="mx-auto max-w-4xl px-6 py-14">
          <h2 className="text-[22px] font-normal tracking-tight">What connects</h2>
          <div className="mt-6 divide-y divide-[var(--hairline)] border-t border-[var(--hairline)]">
            {[
              { k: "Your ad account, read-only", v: "You connect through Meta's own login and grant read access to ads and insights. AdScale can look, never touch." },
              { k: "Every account you can reach", v: "Accounts assigned directly to you and every account under your Business Managers, so an agency with hundreds of clients sees them all." },
              { k: "Day-wise performance", v: "Ads, ad sets and campaigns with their real daily numbers, the history the fatigue and trend reads are built on." },
            ].map((r) => (
              <div key={r.k} className="grid gap-1 py-5 sm:grid-cols-[240px_1fr] sm:gap-8">
                <div className="text-[15px] font-medium text-[var(--ink)]">{r.k}</div>
                <div className="text-[15px] text-[var(--ink-muted)]">{r.v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* What AdScale decides - two-column list */}
        <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="max-w-2xl text-[22px] font-normal tracking-tight">What AdScale decides from it</h2>
            <p className="mt-2 max-w-2xl text-[15px] text-[var(--ink-muted)]">
              Judgment, not another dashboard. Every read is auditable, and nothing is applied automatically.
            </p>
            <div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
              {DECISIONS.map((d) => (
                <div key={d.h}>
                  <h3 className="text-[15px] font-medium text-[var(--ink)]">{d.h}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--ink-muted)]">{d.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The data it reads - wrapped tag row */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-[22px] font-normal tracking-tight">The data it reads</h2>
          <p className="mt-2 max-w-xl text-[15px] text-[var(--ink-muted)]">
            Straight from your account, day by day. No manual exports, no spreadsheets.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {DATA_POINTS.map((p) => (
              <span key={p} className="rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-1.5 text-[13px] text-[var(--ink)]">
                {p}
              </span>
            ))}
          </div>
        </section>

        {/* Read-only and safe - trust callout */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-8">
            <h2 className="text-[22px] font-normal tracking-tight">Read-only, and safe by design</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {[
                { k: "Read access only", v: "AdScale requests read scope for ads and insights. It cannot spend, pause, or change anything in your account." },
                { k: "Tokens encrypted", v: "Your access token is encrypted at rest and never sent back to the browser. Only account ids and names are ever returned." },
                { k: "Drafts, never auto-changes", v: "Every recommendation is a draft you action yourself in your ad account. AdScale does not push edits to Meta." },
                { k: "Disconnect anytime", v: "Revoke the connection from AdScale or from Meta, and the stored token is dropped." },
              ].map((r) => (
                <div key={r.k}>
                  <div className="text-[15px] font-medium text-[var(--ink)]">{r.k}</div>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--ink-muted)]">{r.v}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[var(--hairline)]">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="text-[24px] font-normal tracking-tight">Connect Meta and see your first plan.</h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] text-[var(--ink-muted)]">
              AdScale is in private access. Book a demo and we will get you set up.
            </p>
            <div className="mt-7">
              <Link href="/book-demo" className="inline-block rounded-full bg-[var(--ink)] px-7 py-3 font-medium text-white transition hover:opacity-90">
                Book a demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
