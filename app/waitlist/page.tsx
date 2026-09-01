import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getAccessState } from "@/lib/app/access";
import { signOut } from "@/app/(auth)/actions";

export const metadata: Metadata = {
  title: "You're on the list — AdScale",
  description: "AdScale is currently in private access. Your account is ready; product access is enabled by approval.",
  robots: { index: false, follow: false }, // a signed-in gate screen; not for search
};

// Signed-in-but-not-entitled users land here (from requireProductAccess). Entitled users are bounced to /app;
// signed-out users to /login. Copy is state-appropriate and never exposes internal terms (RBAC/JWT/RLS).
export default async function WaitlistPage() {
  const a = await getAccessState();
  if (!a) redirect("/login");
  if (a.state === "APPROVED" || a.state === "ACTIVE" || a.state === "ADMIN") redirect("/app");

  const blocked = a.state === "SUSPENDED" || a.state === "REVOKED";
  const heading = blocked ? "Access is currently paused" : "You're on the list";
  const line = blocked
    ? "Your account access is on hold. If you think this is a mistake, contact us and we'll take a look."
    : "AdScale is in private access right now. Your account is ready, but product access hasn't been enabled yet.";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-20">
        <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-alt)] px-3 py-1 text-[12px] font-medium text-[var(--ink-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            Private access
          </span>
          <h1 className="mt-4 text-[26px] font-semibold tracking-tight text-[var(--ink)]">{heading}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-muted)]">{line}</p>

          {!blocked && (
            <ul className="mt-5 space-y-2 text-[14px] text-[var(--ink)]">
              <li className="flex gap-2"><span className="text-[var(--accent)]">✓</span> Your account has been created{a.email ? ` (${a.email})` : ""}.</li>
              <li className="flex gap-2"><span className="text-[var(--accent)]">✓</span> You are on the list to request access.</li>
              <li className="flex gap-2"><span className="text-[var(--ink-muted)]">•</span> We will turn on product access as we open more seats.</li>
            </ul>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="mailto:rahul.arora@ekaleido.co?subject=AdScale%20access%20request" className="rounded-[10px] bg-[var(--ink)] px-4 py-2.5 text-[14px] font-medium text-[var(--surface)] hover:opacity-90">
              Request access
            </a>
            <Link href="/blog" className="text-[14px] font-medium text-[var(--ink-muted)] hover:text-[var(--ink)]">Read the blog →</Link>
            <form action={signOut} className="ml-auto">
              <button type="submit" className="text-[13px] text-[var(--ink-muted)] hover:text-[var(--ink)]">Sign out</button>
            </form>
          </div>
        </div>
        <p className="mt-4 px-1 text-[12px] text-[var(--ink-muted)]">No subscription is required or available yet. Access is granted by approval during the private beta.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
