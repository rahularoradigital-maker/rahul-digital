import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/marketing/hero";
import { ProductDemo } from "@/components/marketing/product-demo";
import { UseCases } from "@/components/marketing/use-cases";
import { Method } from "@/components/marketing/method";
import {
  TrustBand,
  FundingCard,
  Features,
  Security,
  Testimonials,
  CaseStudy,
  FinalCta,
} from "@/components/marketing/static-sections";
import { FAQ } from "@/components/marketing/faq";

export default function Home() {
  return (
    <>
      {/* Announcement bar, accent blue */}
      <div className="bg-[var(--accent)] px-5 py-2.5 text-center text-sm text-white">
        AdBrain AI is a certified Meta Business &amp; Technology Partner{" "}
        <a href="#funding" className="font-medium underline underline-offset-2">
          Read More &rarr;
        </a>
      </div>
      <SiteHeader />

      <main className="flex-1">
        <Hero />
        <ProductDemo />
        <TrustBand />
        <UseCases />
        <FundingCard />
        <Method />
        <Features />
        <Security />
        <Testimonials />
        <CaseStudy />
        <FAQ />
        <FinalCta />
      </main>

      <SiteFooter />
    </>
  );
}
