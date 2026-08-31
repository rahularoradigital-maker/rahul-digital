import * as React from "react";
import { cn } from "@/lib/utils";

// Lightweight progress bar (no radix): a track + a fill. `tone` colors the fill.
export function Progress({ value = 0, tone = "default", className }: { value?: number; tone?: "good" | "warn" | "muted" | "default"; className?: string }) {
  const fill = tone === "good" ? "bg-[var(--good-ink)]" : tone === "warn" ? "bg-[var(--warn-ink)]" : tone === "muted" ? "bg-[var(--ink-muted)]" : "bg-primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div className={cn("h-full rounded-full transition-all", fill)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
