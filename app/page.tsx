import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/marketing/hero";
import { ProductDemo } from "@/components/marketing/product-demo";
import { UseCases } from "@/components/marketing/use-cases";
import { Method } from "@/components/marketing/method";
import { Features, Security, FinalCta } from "@/components/marketing/static-sections";
import { FAQ } from "@/components/marketing/faq";

export default function Home() {
  return (
    <>
      {/* Announcement bar, accent blue. Private-beta-by-approval (Rahul): one honest story, no fabricated
          "certified partner" claim; the link is the real conversion action, not an anchor to a removed section. */}
      <div className="bg-[var(--accent)] px-5 py-2.5 text-center text-sm text-white">
        Meta-first creative and media intelligence, now in private beta.{" "}
        <Link href="/book-demo" className="font-medium underline underline-offset-2">
          Request access &rarr;
        </Link>
      </div>
      <SiteHeader />

      <main className="flex-1">
        <Hero />
        <ProductDemo />
        <UseCases />
        <Method />
        <Features />
        <Security />
        <FAQ />
        <FinalCta />
      </main>

      <SiteFooter />
    </>
  );
}
