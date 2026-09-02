import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[22px] font-medium tracking-tight">
          <Logo />
          AdScale AI
        </Link>
        <nav className="hidden items-center gap-8 text-[15px] text-[var(--ink-muted)] md:flex">
          {/* Root-relative on purpose (Phase-0 audit): these sections exist only on the homepage, so a bare
              "#use-cases" resolved to e.g. /pricing#use-cases and silently did nothing on every other page. */}
          <a href="/#use-cases" className="hover:text-[var(--ink)]">Use Cases</a>
          <a href="/#method" className="hover:text-[var(--ink)]">How it works</a>
          <a href="/#features" className="hover:text-[var(--ink)]">Features</a>
          <Link href="/pricing" className="hover:text-[var(--ink)]">Pricing</Link>
          <Link href="/blog" className="hover:text-[var(--ink)]">Blog</Link>
        </nav>
        <div className="flex items-center gap-4 text-[15px]">
          <Link href="/login" className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
            Log in
          </Link>
          {/* Private-beta-by-approval (Rahul): one honest conversion action. Self-serve "Sign up" implied
              instant access the approval gate does not grant; "Request access" routes to the lead form. */}
          <Link
            href="/book-demo"
            className="inline-flex items-center rounded-full bg-[var(--ink)] px-5 py-3 font-medium text-white transition hover:opacity-90"
          >
            Request access
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
