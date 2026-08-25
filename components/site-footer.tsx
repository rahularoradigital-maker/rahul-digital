import Link from "next/link";
import { Logo } from "@/components/site-header";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--hairline)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 text-sm sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Logo className="h-6 w-6" />
            AdBrain AI
          </div>
          <p className="mt-3 max-w-xs text-[var(--ink-muted)]">
            Creative decision intelligence for Meta growth teams. Decide, do not just report.
          </p>
        </div>
        <div>
          <p className="font-medium">Product</p>
          <ul className="mt-3 space-y-2 text-[var(--ink-muted)]">
            <li><a href="/#features" className="hover:text-[var(--ink)]">Features</a></li>
            <li><Link href="/signup" className="hover:text-[var(--ink)]">Get started</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-medium">Company</p>
          <ul className="mt-3 space-y-2 text-[var(--ink-muted)]">
            <li><a href="/#how" className="hover:text-[var(--ink)]">How it works</a></li>
            <li><Link href="/login" className="hover:text-[var(--ink)]">Log in</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-medium">Legal</p>
          <ul className="mt-3 space-y-2 text-[var(--ink-muted)]">
            <li><span>Privacy</span></li>
            <li><span>Terms</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--hairline)] py-6 text-center text-xs text-[var(--ink-muted)]">
        © 2026 AdBrain AI. All rights reserved.
      </div>
    </footer>
  );
}
