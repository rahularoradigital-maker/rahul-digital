import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DemoForm } from "@/components/marketing-extra/demo-form";

// SEO (Phase-0 audit): the primary conversion page had NO metadata export, so it inherited the root's
// title/description and a canonical of "/" - Google read it as a duplicate of the homepage.
export const metadata: Metadata = {
  title: "Book a demo - AdScale",
  description: "See AdScale on your own Meta ad account: a live plan of what to scale, refresh, or pause. Founder-led, no slideware.",
  alternates: { canonical: "/book-demo" },
};

const PERKS = [
  { h: "Built from your real data", d: "We connect your Meta account and show a live plan." },
  { h: "No slideware", d: "Straight to decisions your team can act on Monday." },
  { h: "Founder-led", d: "You talk to the people who built the agents." },
];

export default async function BookDemoPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <>
      {/* Announcement bar */}
      <div className="bg-[var(--accent)] px-4 py-2 text-center text-sm text-white">
        Meta-first creative and media intelligence. Google coming next.
      </div>
      <SiteHeader />

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-14 px-6 py-16 lg:grid-cols-2">
          {/* Left column */}
          <div className="lg:sticky lg:top-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-1.5 text-sm text-[var(--ink-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--good-ink)]" />
              Talk to the founders
            </span>
            <h1 className="mt-6 max-w-md text-4xl leading-[1.04] tracking-tight sm:text-5xl">
              See your first weekly test plan, live.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--ink-muted)]">
              Book 30 minutes. We will connect your account and build a ranked creative plan from
              your own data, no slides, just decisions.
            </p>

            <div className="mt-9 flex flex-col gap-4">
              {PERKS.map((p) => (
                <div key={p.h} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] font-semibold text-[var(--accent)]">
                    &#10003;
                  </span>
                  <div>
                    <div className="text-[15px] font-medium">{p.h}</div>
                    <div className="text-sm text-[var(--ink-muted)]">{p.d}</div>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Right column: form */}
          <DemoForm initialEmail={typeof email === "string" ? email : ""} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
