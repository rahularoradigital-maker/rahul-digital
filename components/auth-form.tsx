"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { GoogleButton } from "@/components/google-button";
import { Logo } from "@/components/site-header";

type Props = {
  mode: "login" | "signup";
  title: string;
  cta: string;
  altText: string;
  altHref: string;
  altLabel: string;
};

const inputCls =
  "mt-1.5 w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 outline-none transition focus:border-[var(--accent)]";

// Auth runs entirely in the browser via the Supabase browser client (cookie-based
// session, shared with the server). This deliberately avoids Next.js Server Actions,
// which some browser extensions that wrap window.fetch break (causing a POST /login 500).
export function AuthForm({ mode, title, cta, altText, altHref, altLabel }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  // Remember the last email used, so a returning user does not retype it.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("adbrain.lastEmail");
      if (saved) setEmail(saved);
    } catch {
      // storage unavailable
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          setError(err.message);
          setPending(false);
          return;
        }
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) {
          setError(err.message);
          setPending(false);
          return;
        }
        if (!data.session) {
          setMessage("Check your email to confirm your account, then log in.");
          setPending(false);
          return;
        }
      }
      try {
        localStorage.setItem("adbrain.lastEmail", email);
      } catch {
        // storage unavailable
      }
      // Full navigation so the server picks up the fresh session cookie.
      window.location.href = "/app";
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-6">
      <div className="rounded-[22px] border border-[var(--hairline)] bg-[var(--surface)] p-8 shadow-[0_30px_70px_-50px_rgba(37,37,37,0.4)]">
        <Link href="/" className="mb-8 flex items-center gap-2 font-medium">
          <Logo />
          AdBrain AI
        </Link>
        <h1 className="text-3xl font-normal tracking-tight text-[var(--ink)]">{title}</h1>

        <div className="mt-7">
          <GoogleButton label={`${cta} with Google`} />
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-[var(--ink-muted)]">
          <span className="h-px flex-1 bg-[var(--hairline)]" />
          or
          <span className="h-px flex-1 bg-[var(--hairline)]" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm text-[var(--ink-muted)]">Email</label>
            <input id="email" name="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="password" className="text-sm text-[var(--ink-muted)]">Password</label>
            <input id="password" name="password" type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} className={inputCls} />
          </div>

          {error && <p className="text-sm text-[var(--bad-ink)]">{error}</p>}
          {message && <p className="text-sm text-[var(--accent)]">{message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-[var(--radius-pill)] bg-[var(--ink)] px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Please wait..." : cta}
          </button>
        </form>

        <p className="mt-6 text-sm text-[var(--ink-muted)]">
          {altText}{" "}
          <Link href={altHref} className="text-[var(--accent)] hover:underline">
            {altLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
