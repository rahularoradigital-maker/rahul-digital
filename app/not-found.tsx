import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">404</p>
      <h1 className="mt-3 text-3xl font-normal tracking-tight text-[var(--ink)]">Page not found</h1>
      <p className="mt-3 text-[var(--ink-muted)]">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/" className="mt-8 rounded-full bg-[var(--ink)] px-5 py-2.5 text-[14px] font-medium text-white transition hover:opacity-90">
        Back to home
      </Link>
    </main>
  );
}
