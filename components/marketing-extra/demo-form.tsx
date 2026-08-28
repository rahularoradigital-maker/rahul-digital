"use client";

import Link from "next/link";
import { useState } from "react";

const SPEND_OPTIONS = ["< $10k", "$10k-50k", "$50k-200k", "$200k+"];

export function DemoForm() {
  const [submitted, setSubmitted] = useState(false);
  const [spend, setSpend] = useState(1);

  if (submitted) {
    return (
      <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-9 shadow-sm">
        <div className="py-10 text-center">
          <div className="mx-auto mb-5 flex h-15 w-15 items-center justify-center rounded-full bg-[var(--good-bg)] text-3xl text-[var(--good-ink)]">
            &#10003;
          </div>
          <h2 className="mb-2.5 text-2xl">Thanks, you are booked.</h2>
          <p className="mx-auto mb-6 max-w-sm text-[var(--ink-muted)]">
            A founder will reach out within one business day to confirm your slot.
          </p>
          <Link
            href="/"
            className="inline-block rounded-full bg-[var(--ink)] px-6 py-3 font-medium text-white transition hover:opacity-90"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-9 shadow-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
      >
        <h2 className="mb-6 text-xl">Request your demo</h2>

        <div className="mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium">First name</label>
            <input
              required
              placeholder="Jordan"
              className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium">Last name</label>
            <input
              required
              placeholder="Rivera"
              className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-[13px] font-medium">Work email</label>
          <input
            required
            type="email"
            placeholder="you@brand.com"
            className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-[13px] font-medium">Brand or agency</label>
          <input
            placeholder="Acme Co."
            className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-[13px] font-medium">Monthly Meta ad spend</label>
          <div className="flex flex-wrap gap-2">
            {SPEND_OPTIONS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setSpend(i)}
                className={
                  "cursor-pointer rounded-full border px-3.5 py-2 text-[13px] font-medium transition " +
                  (spend === i
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]")
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-[13px] font-medium">What do you want to fix?</label>
          <textarea
            rows={3}
            placeholder="e.g. we keep retesting angles that do not work"
            className="w-full resize-y rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <button
          type="submit"
          className="w-full cursor-pointer rounded-full bg-[var(--ink)] px-4 py-3.5 font-medium text-white transition hover:opacity-90"
        >
          Request demo
        </button>
        <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
          By requesting a demo you agree to be contacted for marketing purposes.
        </p>
      </form>
    </div>
  );
}
