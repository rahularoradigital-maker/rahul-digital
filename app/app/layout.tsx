import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/site-header";

// Telli app shell: fixed 256px sidebar (grouped nav) + sticky topbar. Only the
// Cockpit is built today; the rest of the IA is shown as "soon" so the map is honest.
const NAV: { group: string; items: { label: string; href?: string }[] }[] = [
  { group: "Decide", items: [{ label: "Account Cockpit", href: "/app" }, { label: "Action Center" }, { label: "Test Plan" }] },
  { group: "Creative", items: [{ label: "Creative Fatigue" }, { label: "Diversity & White Space" }, { label: "Brand Brain" }] },
  { group: "Media", items: [{ label: "Budget & Scaling" }, { label: "Analytics" }] },
  { group: "Intelligence", items: [{ label: "Competitors" }, { label: "Voice of Customer" }] },
  { group: "Account", items: [{ label: "Settings" }] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-1">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-[var(--hairline)] bg-[var(--surface)] md:flex">
        <Link href="/app" className="flex items-center gap-2 px-5 py-4 text-[19px] font-semibold">
          <Logo />
          AdBrain AI
        </Link>
        <nav className="flex-1 px-3 pb-6 text-sm">
          {NAV.map((section) => (
            <div key={section.group} className="mt-3 first:mt-0">
              <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                {section.group}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) =>
                  item.href ? (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="block rounded-lg bg-[var(--accent-soft)] px-3 py-2 font-medium text-[var(--accent)]"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ) : (
                    <li
                      key={item.label}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-[var(--ink-muted)]"
                    >
                      <span>{item.label}</span>
                      <span className="rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
                        soon
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-6 py-3">
            {/* Left: mobile logo + page title + live status */}
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/app" className="flex items-center gap-2 font-medium md:hidden">
                <Logo />
              </Link>
              <h1 className="truncate text-xl tracking-tight">Account Cockpit</h1>
              <span className="hidden items-center gap-1.5 text-xs text-[var(--ink-muted)] sm:flex">
                <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-[var(--good-ink)]" />
                Agents live
              </span>
            </div>

            {/* Right: search + selector + re-scan + user */}
            <div className="flex items-center gap-3 text-sm">
              <label className="hidden items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-[var(--ink-muted)] lg:flex">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3-3" />
                </svg>
                <input
                  readOnly
                  placeholder="Ask AdBrain anything"
                  aria-label="Ask AdBrain"
                  className="w-40 bg-transparent text-[13px] outline-none placeholder:text-[var(--ink-muted)]"
                />
              </label>

              <span className="hidden rounded-[var(--radius-pill)] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium md:inline">
                Meta · Week 34 ▾
              </span>

              <button
                type="button"
                className="rounded-[var(--radius-pill)] bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90"
              >
                Re-scan
              </button>

              <span className="hidden text-[var(--ink-muted)] xl:inline">{user?.email}</span>
              <form action={signOut}>
                <button className="rounded-[var(--radius-pill)] border border-[var(--hairline)] px-4 py-1.5 transition hover:bg-[var(--surface-alt)]">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
