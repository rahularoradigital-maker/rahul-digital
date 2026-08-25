import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand)] text-[var(--brand-foreground)] text-sm font-bold">
            A
          </span>
          AdBrain
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[var(--muted)] md:flex">
          <a href="/#features" className="hover:text-[var(--foreground)]">Features</a>
          <a href="/#compare" className="hover:text-[var(--foreground)]">Compare</a>
          <a href="/#how" className="hover:text-[var(--foreground)]">How it works</a>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[var(--brand)] px-4 py-2 font-medium text-[var(--brand-foreground)] transition hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
