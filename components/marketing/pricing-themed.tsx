"use client";

// Themed /pricing content in the shared marketing theme. Keeps the existing PricingTiers (currency toggle)
// and PricingEstimator logic untouched; metadata + BreadcrumbList/FAQPage JSON-LD stay in the server page.
import { ThemeShell, SecHead } from "@/components/marketing/theme-shell";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { PricingEstimator } from "@/components/marketing/pricing-estimator";

export default function PricingThemed({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <ThemeShell active="/pricing">
      <section className="page-hero">
        <div className="wrap">
          <div className="eyebrow"><span className="tick" /><span className="lab">Pricing</span></div>
          <h1>Simple, usage-based pricing.</h1>
          <p className="lede">Every plan includes unlimited scale, refresh, and kill decisions, with a reason for each. Tokens power the AI extras, so you only pay for what actually costs to produce. AdScale is in private beta, access by approval.</p>
        </div>
      </section>

      <section className="blk"><div className="wrap"><PricingTiers /></div></section>
      <section className="blk"><div className="wrap"><PricingEstimator /></div></section>

      <section className="blk">
        <div className="wrap">
          <SecHead num="/ FAQ" title="Pricing questions." />
          <div className="faq">
            {faqs.map((f, i) => (<details className="qa rv" key={i}><summary>{f.q}</summary><p>{f.a}</p></details>))}
          </div>
        </div>
      </section>

      <section className="close">
        <div className="wrap">
          <div className="lab" style={{ marginBottom: 18 }}>Private beta, by approval</div>
          <h2>Start with unlimited decisions.</h2>
          <p>Request access and we will review your account. New sign-ups join the waitlist until approved.</p>
          <div className="ctas" style={{ justifyContent: "center" }}><a className="btn solid" href="/book-demo">Request access</a></div>
        </div>
      </section>
    </ThemeShell>
  );
}
