import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahul-digital.vercel.app";
const TITLE = "Google Ads integration for AdBrain";
const DESCRIPTION =
  "AdBrain reads Google Ads the way a media buyer thinks: budget-capped vs rank-capped, Quality Score drag, and value-bidding readiness, per campaign type. Read-only, and rolling out now.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/integrations/google-ads" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/integrations/google-ads`, siteName: "AdBrain AI" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// The Google-native decisioning AdBrain already computes (lib/google/**). Honest: framed as rolling out,
// because the read-only Google Ads API connection is being enabled. No invented metrics or results.
const DECISIONS: { h: string; d: string }[] = [
  { h: "Budget-capped or rank-capped, answered", d: "Impression share split into lost-to-budget vs lost-to-rank, so you raise budget on a winner or fix Ad Rank, never the wrong lever." },
  { h: "Quality Score, where it costs you", d: "Low Quality Score on real spend is flagged with the weakest component to fix, ranked by the money a fix would save." },
  { h: "Ready for value bidding", d: "When a campaign has enough conversions and distinct values, AdBrain flags that it is ready to move to Target ROAS, not before." },
  { h: "The metric that matters, per type", d: "Search leads on cost per conversion and impression share, Shopping and PMax on ROAS, Video on view rate. The right north-star for each campaign type." },
  { h: "Learning-phase safe", d: "AdBrain will not tell you to change a bid or budget while Smart Bidding is still learning, because that change would reset it and cost you." },
  { h: "One brain across Meta and Google", d: "The same money-at-stake ranking and reason-for-every-call rigor, now reading Google's own levers instead of forcing a Meta-shaped view onto it." },
];

const DATA_POINTS = ["Cost", "Impressions", "Clicks", "Conversions", "Conversion value", "ROAS", "CPA", "Search impression share", "Lost IS (budget)", "Lost IS (rank)", "Quality Score", "Campaign type"];

export default function GoogleAdsIntegrationPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="bg-[var(--accent)] px-4 py-2 text-center text-sm text-white">
        Meta is live today. Google Ads is rolling out now.
      </div>
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 pt-20 pb-14 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-1.5 text-sm text-[var(--ink-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            Google Ads integration · rolling out
          </span>
          <h1 className="mx-auto mt-6 max-w-2xl text-4xl leading-[1.06] tracking-tight sm:text-5xl">
            Google Ads, read the way a buyer thinks.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--ink-muted)]">
            Not a Meta view forced onto Google. AdBrain reads the Google levers, budget vs rank, Quality Score, value bidding, and tells you what to change, with a reason.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/book-demo" className="inline-block rounded-full bg-[var(--ink)] px-7 py-3 font-medium text-white transition hover:opacity-90">
              Book a demo
            </Link>
            <a href="#how" className="text-[15px] font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]">
              See what it reads
            </a>
          </div>
        </section>

        {/* What connects */}
        <section id="how" className="mx-auto max-w-4xl px-6 py-14">
          <h2 className="text-[22px] font-normal tracking-tight">What connects</h2>
          <div className="mt-6 divide-y divide-[var(--hairline)] border-t border-[var(--hairline)]">
            {[
              { k: "Your Google Ads account, read-only", v: "Connect through Google's own login and grant read access. AdBrain reads performance, it never spends or changes anything." },
              { k: "Every campaign type", v: "Search, Performance Max, Shopping, Demand Gen and Video, each judged on the metric that actually matters for it." },
              { k: "The auction signals Meta does not have", v: "Impression share, lost impression share, and Quality Score, the levers that decide whether Google shows your ad at all." },
            ].map((r) => (
              <div key={r.k} className="grid gap-1 py-5 sm:grid-cols-[240px_1fr] sm:gap-8">
                <div className="text-[15px] font-medium text-[var(--ink)]">{r.k}</div>
                <div className="text-[15px] text-[var(--ink-muted)]">{r.v}</div>
              </div>
            ))}
          </div>
        </section>

        {/* What AdBrain decides */}
        <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="max-w-2xl text-[22px] font-normal tracking-tight">What AdBrain decides from it</h2>
            <p className="mt-2 max-w-2xl text-[15px] text-[var(--ink-muted)]">
              Deterministic routing, grounded in how the Google algorithm actually behaves. Nothing is applied automatically.
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

        {/* The data it reads */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-[22px] font-normal tracking-tight">The signals it reads</h2>
          <p className="mt-2 max-w-xl text-[15px] text-[var(--ink-muted)]">
            The numbers that decide whether you show, and whether you win.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {DATA_POINTS.map((p) => (
              <span key={p} className="rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-1.5 text-[13px] text-[var(--ink)]">
                {p}
              </span>
            ))}
          </div>
        </section>

        {/* Security */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-8">
            <h2 className="text-[22px] font-normal tracking-tight">Read-only, and safe by design</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {[
                { k: "Read access only", v: "AdBrain requests read scope for campaigns and metrics. It cannot spend, pause, or change your account." },
                { k: "Tokens encrypted", v: "Your access token is encrypted at rest and never returned to the browser." },
                { k: "Drafts, never auto-changes", v: "Every recommendation is a draft you action yourself in Google Ads." },
                { k: "Disconnect anytime", v: "Revoke access from AdBrain or from Google, and the stored token is dropped." },
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
            <h2 className="text-[24px] font-normal tracking-tight">Be first on Google Ads.</h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] text-[var(--ink-muted)]">
              Meta is live today and Google is rolling out. Book a demo for early access.
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
