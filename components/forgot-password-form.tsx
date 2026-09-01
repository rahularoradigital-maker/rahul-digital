"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const inputCls =
  "mt-1.5 w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 outline-none transition focus:border-[var(--accent)]";

// Step 1 of account recovery: email a one-time reset link (Supabase issues, expires, and single-uses the
// token - we never hand-roll it). The link lands on /reset-password. The success copy is enumeration-safe:
// it never reveals whether an account exists for that email.
export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    } catch {
      // Swallow: we show the same neutral message either way, so an error never leaks account existence.
    }
    setSent(true);
    setPending(false);
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-6">
      <div className="rounded-[22px] border border-[var(--hairline)] bg-[var(--surface)] p-8 shadow-[0_30px_70px_-50px_rgba(37,37,37,0.4)]">
        <Link href="/" className="mb-8 flex items-center gap-2 font-medium">
          <Logo />
          AdScale AI
        </Link>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--ink)]">Reset your password</h1>

        {sent ? (
          <p className="mt-6 text-sm text-[var(--ink-muted)]">
            If an account exists for that email, we&apos;ve sent a link to reset your password. Check your inbox, and your spam folder.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm text-[var(--ink-muted)]">Enter your email and we&apos;ll send you a reset link.</p>
            <form onSubmit={onSubmit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="email" className="text-sm text-[var(--ink-muted)]">Email</label>
                <Input id="email" name="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
              <Button type="submit" disabled={pending} className="w-full rounded-full bg-[var(--ink)] px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60">
                {pending ? "Please wait..." : "Send reset link"}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-sm text-[var(--ink-muted)]">
          <Link href="/login" className="text-[var(--accent)] hover:underline">Back to log in</Link>
        </p>
      </div>
    </div>
  );
}
