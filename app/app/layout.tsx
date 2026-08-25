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
      <aside className="hidden w-64 shrink-0 border-r border-[var(--hairline)] bg-[var(--surface)] md:flex md:flex-col">
        <Link href="/app" className="flex items-center gap-2 border-b border-[var(--hairline)] px-5 py-4 font-medium">
          <Logo />
          AdBrain AI
        </Link>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 text-sm">
          {NAV.map((section) => (
            <div key={section.group}>
              <div className="px-2 text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">{section.group}</div>
              <ul className="mt-2 space-y-0.5">
                {section.items.map((item) =>
                  item.href ? (
                    <li key={item.label}>
                      <Link href={item.href} className="block rounded-lg bg-[var(--accent-soft)] px-3 py-2 font-medium text-[var(--accent)]">
                        {item.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={item.label} className="flex items-center justify-between rounded-lg px-3 py-2 text-[var(--ink-muted)]">
                      <span>{item.label}</span>
                      <span className="rounded-full bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] uppercase">soon</span>
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
          <div className="flex items-center justify-between px-6 py-3">
            <Link href="/app" className="flex items-center gap-2 font-medium md:hidden">
              <Logo />
              AdBrain AI
            </Link>
            <div className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--good-ink)]" />
              Agents live
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="hidden text-[var(--ink-muted)] sm:inline">{user?.email}</span>
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
