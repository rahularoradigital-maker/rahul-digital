import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// Shared shell for the legal/trust pages (privacy, terms, cookies), so header, footer, and prose styling
// live in one place. The content of each page is real and specific to AdScale, but is boilerplate pending a
// lawyer's review - the banner says so plainly rather than pretending it is final legal text.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-normal tracking-tight text-[var(--ink)]">{title}</h1>
        <p className="mt-3 text-sm text-[var(--ink-muted)]">Last updated: {updated}</p>
        <div className="mt-4 rounded-[10px] border border-[var(--warn-ink)]/30 bg-[var(--warn-bg)] px-4 py-3 text-sm text-[var(--warn-ink)]">
          This document is a working draft under legal review. It reflects how AdScale operates today; the final wording will be confirmed by counsel before general availability.
        </div>
        <div className="legal-prose mt-8 space-y-6 text-[15px] leading-relaxed text-[var(--ink)]">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
