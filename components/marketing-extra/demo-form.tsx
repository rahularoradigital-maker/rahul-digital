"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const SPEND_OPTIONS = ["< $10k", "$10k-50k", "$50k-200k", "$200k+"];

export function DemoForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [spend, setSpend] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [brand, setBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          brand,
          spend_bucket: SPEND_OPTIONS[spend],
          notes,
          source: "book-demo",
          company_website: honeypot,
        }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) {
        setError(d.error ?? "Could not send. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Could not send. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

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
      <form onSubmit={submit}>
        <h2 className="mb-6 text-xl">Request your demo</h2>

        {/* Honeypot: hidden from real users, bots fill it and get silently dropped. */}
        <input
          type="text"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
          aria-hidden="true"
        />

        <div className="mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium">First name</label>
            <Input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jordan"
              className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium">Last name</label>
            <Input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Rivera"
              className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-[13px] font-medium">Work email</label>
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@brand.com"
            className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-[13px] font-medium">Brand or agency</label>
          <Input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
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
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. we keep retesting angles that do not work"
            className="w-full resize-y rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent)]"
          />
        </div>

        {error && (
          <p className="mb-3 rounded-[10px] border border-[var(--bad-ink)]/30 bg-[var(--bad-bg)] px-3.5 py-2.5 text-[13px] text-[var(--bad-ink)]">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={sending}
          className="w-full cursor-pointer rounded-full bg-[var(--ink)] px-4 py-3.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "Sending..." : "Request demo"}
        </Button>
        <p className="mt-3 text-xs leading-relaxed text-[var(--ink-muted)]">
          By requesting a demo you agree to be contacted for marketing purposes.
        </p>
      </form>
    </div>
  );
}
