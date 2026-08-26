"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "@/app/(auth)/actions";
import { GoogleButton } from "@/components/google-button";
import { Logo } from "@/components/site-header";

type Props = {
  title: string;
  cta: string;
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  altText: string;
  altHref: string;
  altLabel: string;
};

const inputCls =
  "mt-1.5 w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 outline-none transition focus:border-[var(--accent)]";

export function AuthForm({ title, cta, action, altText, altHref, altLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

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

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm text-[var(--ink-muted)]">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className={inputCls} />
          </div>
          <div>
            <label htmlFor="password" className="text-sm text-[var(--ink-muted)]">Password</label>
            <input id="password" name="password" type="password" required minLength={6} autoComplete="current-password" className={inputCls} />
          </div>

          {state?.error && <p className="text-sm text-[var(--bad-ink)]">{state.error}</p>}
          {state?.message && <p className="text-sm text-[var(--accent)]">{state.message}</p>}

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
