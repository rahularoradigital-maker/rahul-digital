"use client";

// App-level error boundary. Without this, ANY runtime error in a /app route render bubbles to
// the framework and shows a raw "server error" 500 (which is what a cache/schema mismatch caused
// on 2026-08-28). With it, the user sees a recoverable screen and can retry - the page stays up
// for everyone even when one render throws. `reset()` re-renders the segment; a full reload is
// offered as the harder retry.
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h1 className="mb-1.5 text-lg font-normal">This screen hit a snag</h1>
        <p className="mb-5 text-[13px] text-[var(--ink-muted)]">
          Something went wrong loading your cockpit. Your data is safe. Try again, and if it keeps
          happening use Re-scan or switch account.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="default"
            size="sm"
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-[var(--ink)] px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
          >
            Try again
          </Button>
          <a
            href="/app"
            className="rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-[13px] font-medium text-[var(--ink)] transition hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
          >
            Reload
          </a>
        </div>
        {error?.digest && (
          <p className="mt-4 font-mono text-[11px] text-[var(--faint,var(--ink-muted))]">ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
