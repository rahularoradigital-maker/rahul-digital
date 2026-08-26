import Link from "next/link";
import { Logo } from "@/components/site-header";

const COLS = [
  { title: "Platform", links: ["Use Cases", "Features", "Solutions", "Book a demo"] },
  { title: "Solutions", links: ["Beauty & Skincare", "Apparel", "Health & Wellness", "Agencies"] },
  { title: "Resources", links: ["Blog", "Trending Ads", "Attention Heatmap", "Documentation"] },
  { title: "Company", links: ["Contact us", "About us", "Join us", "Terms"] },
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
                  <li key={lk}>
                    <Link href="/signup" className="text-[15px] hover:text-[var(--accent)]">
                      {lk}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-[var(--hairline)] pt-6 text-[13px] text-[var(--ink-muted)]">
          &copy; 2026 adbrain.ai, All rights reserved
        </div>
      </div>
    </footer>
  );
}
