"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Client island (cleanup #5): only the Generate/Regenerate button. The positioning synthesis is a server
// POST (grounded Gemini) that CACHES the result in creative_insights; on success we router.refresh() so the
// SERVER component re-renders the newly-cached positioning. The section content itself is server-rendered
// (positioning-section.tsx) - this used to be a "use client" component that fetched the cached content in a
// useEffect and flashed "Loading…". Now only this button ships client JS.
export function GeneratePositioning({ hasContent }: { hasContent: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/market/positioning", { method: "POST" });
      const d = (await res.json()) as { content?: string; error?: string };
      if (!res.ok || !d.content) {
        setError(d.error ?? "Could not generate right now. Please try again.");
        return;
      }
      startTransition(() => router.refresh()); // re-render the server section with the freshly-cached content
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || pending;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="default"
          onClick={generate}
          disabled={busy}
          className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Reading your ads and market..." : hasContent ? "Regenerate" : "Generate positioning"}
        </Button>
        {hasContent && <span className="text-[13px] text-[var(--ink-muted)]">From your real ads and profile · grounded, not invented</span>}
      </div>
      {error && <p className="mt-2 text-[13px] text-[var(--bad-ink)]">{error}</p>}
    </>
  );
}
