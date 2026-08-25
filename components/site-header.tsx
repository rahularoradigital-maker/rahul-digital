import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-medium tracking-tight">
          <Logo />
          AdBrain AI
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[var(--ink-muted)] md:flex">
          <a href="/#features" className="hover:text-[var(--ink)]">Features</a>
          <a href="/#how" className="hover:text-[var(--ink)]">How it works</a>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-[var(--radius-pill)] bg-[var(--ink)] px-5 py-2 font-medium text-white transition hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`grid h-7 w-7 place-items-center rounded-lg bg-[var(--ink)] text-sm font-semibold text-white ${className}`}>
      A
    </span>
  );
}
