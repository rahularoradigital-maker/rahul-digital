import { ThemeShell } from "@/components/marketing/theme-shell";

// Shared shell for the legal/trust pages (privacy, terms, cookies, data-deletion), so header, footer, and
// prose styling live in one place. The content of each page is real and specific to AdScale, but is
// boilerplate pending a lawyer's review - the banner says so plainly rather than pretending it is final text.
// Uses the shared marketing theme (ThemeShell) so the legal pages match the rest of the site.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <ThemeShell>
      <section className="page-hero" style={{ borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 780 }}>
          <h1 style={{ maxWidth: "18ch" }}>{title}</h1>
          <p className="lab" style={{ marginTop: 4 }}>Last updated: {updated}</p>
          <div style={{ marginTop: 20, border: "1px solid var(--line2)", background: "var(--bg2)", padding: "14px 18px", fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>
            This document is a working draft under legal review. It reflects how AdScale operates today; the final wording will be confirmed by counsel before general availability.
          </div>
          <div className="legal-prose prose-rd" style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 28 }}>{children}</div>
        </div>
      </section>
    </ThemeShell>
  );
}
