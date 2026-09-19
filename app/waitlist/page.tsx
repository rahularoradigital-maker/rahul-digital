import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeShell } from "@/components/marketing/theme-shell";
import { getAccessState } from "@/lib/app/access";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

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
    <ThemeShell>
      <section className="page-hero" style={{ borderBottom: "none" }}>
        <div className="wrap" style={{ maxWidth: 640 }}>
          <div style={{ border: "1px solid var(--line2)", background: "var(--bg2)", padding: "38px 34px" }}>
            <div className="lab" style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
              Private access
            </div>
            <h1 style={{ fontSize: "clamp(1.7rem,4vw,2.4rem)", margin: "0 0 14px" }}>{heading}</h1>
            <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6, margin: 0 }}>{line}</p>

            {!blocked && (
              <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                <li style={{ display: "flex", gap: 10 }}><span style={{ color: "var(--accent)" }}>&#10003;</span> Your account has been created{a.email ? ` (${a.email})` : ""}.</li>
                <li style={{ display: "flex", gap: 10 }}><span style={{ color: "var(--accent)" }}>&#10003;</span> You are on the list to request access.</li>
                <li style={{ display: "flex", gap: 10, color: "var(--muted)" }}><span>&middot;</span> We will turn on product access as we open more seats.</li>
              </ul>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 28 }}>
              <a className="btn solid" href="mailto:rahul.arora@ekaleido.co?subject=AdScale%20access%20request">Request access</a>
              <Link href="/blog" style={{ fontFamily: "var(--mono)", fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)" }}>Read the blog &rarr;</Link>
              <form action={signOut} style={{ marginLeft: "auto" }}>
                <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-[13px]" style={{ color: "var(--muted)" }}>Sign out</Button>
              </form>
            </div>
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: "var(--faint)" }}>No subscription is required or available yet. Access is granted by approval during the private beta.</p>
        </div>
      </section>
    </ThemeShell>
  );
}
