"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Pill email-capture used in the hero and the final CTA. On submit it carries the
// email into signup so nothing is lost. Kept as one shared client component so the
// two capture blocks stay identical.
export function EmailCapture() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = email.trim() ? `?email=${encodeURIComponent(email.trim())}` : "";
    router.push(`/book-demo${q}`);
  }

  return (
    <form
      onSubmit={submit}
      className="flex max-w-[460px] items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface)] p-1.5"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="What's your work email?"
        aria-label="Work email"
        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)]"
      />
      <Button
        type="submit"
        className="inline-flex shrink-0 items-center rounded-full bg-[var(--ink)] px-5 py-2.5 text-[15px] font-medium text-white transition hover:opacity-90"
      >
        Book a demo
      </Button>
    </form>
  );
}
