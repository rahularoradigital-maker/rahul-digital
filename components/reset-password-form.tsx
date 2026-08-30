"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/site-header";

const inputCls =
  "mt-1.5 w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 outline-none transition focus:border-[var(--accent)]";

// Step 2 of account recovery: the user arrives here from the emailed link. Supabase's browser client
// detects the recovery token in the URL and opens a short-lived recovery session (PASSWORD_RECOVERY);
// we then set the new password with updateUser. If there is no recovery session (link expired, reused, or
// opened directly), we say so instead of silently failing.
export function ResetPasswordForm() {
  const [ready, setReady] = useState(false); // a valid recovery session is present
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // If the client already established a recovery session from the URL, we're ready.
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) { setError(err.message); setPending(false); return; }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setPending(false);
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-6">
      <div className="rounded-[22px] border border-[var(--hairline)] bg-[var(--surface)] p-8 shadow-[0_30px_70px_-50px_rgba(37,37,37,0.4)]">
        <Link href="/" className="mb-8 flex items-center gap-2 font-medium">
          <Logo />
          AdBrain AI
        </Link>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--ink)]">Set a new password</h1>

        {done ? (
          <>
            <p className="mt-6 text-sm text-[var(--ink-muted)]">Your password has been updated.</p>
            <p className="mt-6 text-sm">
              <Link href="/login" className="text-[var(--accent)] hover:underline">Log in with your new password</Link>
            </p>
          </>
        ) : !ready ? (
          <p className="mt-6 text-sm text-[var(--ink-muted)]">
            This reset link is invalid or has expired.{" "}
            <Link href="/forgot-password" className="text-[var(--accent)] hover:underline">Request a new one</Link>.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="password" className="text-sm text-[var(--ink-muted)]">New password</label>
              <input id="password" name="password" type="password" required minLength={6} autoComplete="new-password" className={inputCls} />
            </div>
            {error && <p className="text-sm text-[var(--bad-ink)]">{error}</p>}
            <button type="submit" disabled={pending} className="w-full rounded-full bg-[var(--ink)] px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60">
              {pending ? "Please wait..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
