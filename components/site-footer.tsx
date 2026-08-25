import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-[var(--border)]">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 text-sm sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-bold">
              A
            </span>
            AdBrain
          </div>
          <p className="mt-3 max-w-xs text-[var(--muted)]">
            Creative decision intelligence for growth teams. Test smarter, spend less.
          </p>
        </div>
        <div>
          <p className="font-medium">Product</p>
          <ul className="mt-3 space-y-2 text-[var(--muted)]">
            <li><a href="/#features" className="hover:text-[var(--foreground)]">Features</a></li>
            <li><a href="/#compare" className="hover:text-[var(--foreground)]">Compare</a></li>
            <li><Link href="/signup" className="hover:text-[var(--foreground)]">Get started</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-medium">Company</p>
          <ul className="mt-3 space-y-2 text-[var(--muted)]">
            <li><a href="/#how" className="hover:text-[var(--foreground)]">How it works</a></li>
            <li><Link href="/login" className="hover:text-[var(--foreground)]">Log in</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-medium">Legal</p>
          <ul className="mt-3 space-y-2 text-[var(--muted)]">
            <li><span>Privacy</span></li>
            <li><span>Terms</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[var(--border)] py-6 text-center text-xs text-[var(--muted)]">
        © 2026 AdBrain. All rights reserved.
      </div>
    </footer>
  );
}
