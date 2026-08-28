import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[22px] font-medium tracking-tight">
          <Logo />
          AdBrain AI
        </Link>
        <nav className="hidden items-center gap-8 text-[15px] text-[var(--ink-muted)] md:flex">
          <a href="#use-cases" className="hover:text-[var(--ink)]">Use Cases</a>
          <a href="#method" className="hover:text-[var(--ink)]">How it works</a>
          <a href="#features" className="hover:text-[var(--ink)]">Features</a>
        </nav>
        <div className="flex items-center gap-4 text-[15px]">
          <Link href="/login" className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-full bg-[var(--ink)] px-5 py-3 font-medium text-white transition hover:opacity-90"
          >
            Sign up
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
