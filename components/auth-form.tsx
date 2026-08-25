"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthState } from "@/app/(auth)/actions";
import { GoogleButton } from "@/components/google-button";

type Props = {
  title: string;
  cta: string;
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  altText: string;
  altHref: string;
  altLabel: string;
};

export function AuthForm({ title, cta, action, altText, altHref, altLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--brand)] text-[var(--brand-foreground)] text-sm font-bold">
          A
        </span>
        AdBrain
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>

      <div className="mt-6">
        <GoogleButton label={`${cta} with Google`} />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        or
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="text-sm text-[var(--muted)]">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--brand)]"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm text-[var(--muted)]">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--brand)]"
          />
        </div>

        {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
        {state?.message && <p className="text-sm text-[var(--brand)]">{state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[var(--brand)] px-4 py-2 font-medium text-[var(--brand-foreground)] transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Please wait..." : cta}
        </button>
      </form>

      <p className="mt-6 text-sm text-[var(--muted)]">
        {altText}{" "}
        <Link href={altHref} className="text-[var(--brand)] hover:underline">
          {altLabel}
        </Link>
      </p>
    </div>
  );
}
