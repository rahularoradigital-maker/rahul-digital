import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Before Supabase is configured, there is no auth to check. Send to home
  // instead of crashing. See SETUP.md.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/app" className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand)] text-[var(--brand-foreground)] text-sm font-bold">
              A
            </span>
            AdBrain
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[var(--muted)]">{user?.email}</span>
            <form action={signOut}>
              <button className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--card)]">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
