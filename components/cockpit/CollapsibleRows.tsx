"use client";

import { Children, useState, type ReactNode } from "react";

// Collapses a long, low-signal list behind a "Show all" toggle so the cockpit is not a wall of
// identical rows. It receives already-rendered rows (server components pass their output as
// children), counts them, and shows only the first `initial` until expanded - no data or formatting
// logic moves to the client, so server-side rupee/number formatting stays intact.
export function CollapsibleRows({ children, initial, noun = "rows" }: { children: ReactNode; initial: number; noun?: string }) {
  const [open, setOpen] = useState(false);
  const all = Children.toArray(children);
  if (all.length <= initial) return <>{all}</>;
  const shown = open ? all : all.slice(0, initial);
  const hidden = all.length - initial;
  return (
    <>
      {shown}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-1 flex w-full items-center justify-center gap-1.5 border-t border-[var(--surface-alt)] pt-3.5 text-[13px] font-medium text-[var(--accent)] transition hover:opacity-80"
      >
        {open ? "Show less" : `Show ${hidden} more ${noun}`}
        <span aria-hidden="true" className="text-[11px]">{open ? "▴" : "▾"}</span>
      </button>
    </>
  );
}
