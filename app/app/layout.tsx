import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/app/user";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/site-header";
import { SidebarNav } from "@/components/app/sidebar-nav";
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

  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-1">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-4 md:flex">
        <Link href="/app" className="flex items-center gap-2.5 px-2 py-1.5 text-[19px] font-semibold">
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
          <Topbar />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
