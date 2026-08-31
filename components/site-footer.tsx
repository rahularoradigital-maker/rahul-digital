import Link from "next/link";
import { Logo } from "@/components/site-header";

// Each link is { label, href }. Product/marketing links point at the demo funnel (nothing to over-promise
// yet); the legal + contact links point at real, published pages so no footer link is a dead end.
const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Platform", links: [
    { label: "Use Cases", href: "/product" }, { label: "Features", href: "/product" },
    { label: "Solutions", href: "/product" }, { label: "Book a demo", href: "/book-demo" },
  ] },
  { title: "Solutions", links: [
    { label: "Beauty & Skincare", href: "/book-demo" }, { label: "Apparel", href: "/book-demo" },
    { label: "Health & Wellness", href: "/book-demo" }, { label: "Agencies", href: "/book-demo" },
  ] },
  { title: "Resources", links: [
    { label: "Blog", href: "/blog" }, { label: "Meta ads guides", href: "/blog" },
    { label: "Creative strategy", href: "/blog" }, { label: "Book a demo", href: "/book-demo" },
  ] },
  { title: "Company", links: [
    { label: "Contact us", href: "mailto:hello@adbrain.ai" }, { label: "Book a demo", href: "/book-demo" },
    { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" },
  ] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--hairline)] bg-[var(--surface)] py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-medium">
              <Logo />
              AdBrain AI
            </div>
            <p className="mt-4 text-sm text-[var(--ink-muted)]">Bengaluru | San Francisco</p>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
                {col.title}
              </h4>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((lk) => (
                  <li key={lk.label}>
                    <Link href={lk.href} className="text-[15px] hover:text-[var(--accent)]">
                      {lk.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--hairline)] pt-6 text-[13px] text-[var(--ink-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; 2026 adbrain.ai, All rights reserved</span>
          <nav className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-[var(--accent)]">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[var(--accent)]">Terms</Link>
            <Link href="/cookie-policy" className="hover:text-[var(--accent)]">Cookies</Link>
            <Link href="/data-deletion" className="hover:text-[var(--accent)]">Data deletion</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
