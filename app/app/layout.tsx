import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/app/user";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/site-header";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { MobileNav } from "@/components/app/mobile-nav";
import { Topbar } from "@/components/app/topbar";

// AdBrain app shell: fixed 256px sidebar (grouped nav + user footer) + working
// sticky topbar. Nav lives in lib/app/nav.ts; the sidebar highlights the active
// route and the topbar derives its title from it.

function initials(email?: string): string {
  if (!email) return "AB";
  const parts = email.split(/[.@_-]/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "AB";
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/");

  // Server-side auth guard: never trust middleware alone (a middleware bypass or build gap
  // would otherwise render the whole /app shell + Market to unauthenticated requests). The
  // cockpit data loader already redirects, but the layout and no-data pages (Market) need
  // their own guard.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-1">
      {/* Skip-link: lets keyboard users jump past the sidebar nav straight to the content. */}
      <a
        href="#main-content"
        className="sr-only rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-white focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
      >
        Skip to content
      </a>
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-4 md:flex">
        <Link href="/app" className="flex items-center gap-2.5 px-2 py-1.5 text-[17px] font-semibold">
          <Logo />
          AdBrain AI
        </Link>

        <SidebarNav />

        {/* User footer */}
        <div className="mt-4 flex items-center gap-2.5 border-t border-[var(--hairline)] pt-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[13px] font-semibold text-white">
            {initials(user?.email)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-medium">{user?.email ?? "Signed in"}</div>
            <form action={signOut}>
              <button className="text-xs text-[var(--ink-muted)] transition hover:text-[var(--ink)]">Sign out</button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur">
          <div className="flex items-start">
            <div className="pl-2 pt-2.5 md:hidden">
              <MobileNav userEmail={user?.email} />
            </div>
            <div className="min-w-0 flex-1">
              <Topbar />
            </div>
          </div>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
