"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";

// One accessible popover shell for every topbar scope filter (Phase-0 audit: the 7 switchers each
// hand-rolled open/outside-click/Escape and shared none of the keyboard/focus behaviour, and advertised
// aria-haspopup="listbox" over plain checkboxes - a role mismatch). This centralises the WCAG behaviour the
// switchers were missing: focus moves INTO the panel on open, Tab is TRAPPED inside it, Escape closes AND
// restores focus to the trigger, outside-click closes. The panel is a role="dialog" (these menus contain a
// search box + checkboxes, so dialog is the honest role, not listbox). Each switcher keeps its own data +
// option rendering and just supplies them as children - no behaviour is duplicated per switcher any more.
//
// children may be a render-prop receiving `close()` so an option can dismiss the panel when appropriate.

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function FilterPopover({
  label,
  summary,
  pending = false,
  dialogLabel,
  width = "w-56",
  align = "right",
  onOpen,
  children,
}: {
  label: string; // the muted prefix, e.g. "Objective"
  summary: string; // the current value, e.g. "All objectives"
  pending?: boolean; // shows the "Updating..." state during a router.refresh transition
  dialogLabel?: string; // accessible name for the panel (defaults to `label`)
  width?: string; // tailwind width class for the panel
  align?: "left" | "right";
  onOpen?: () => void; // fired when the panel opens (e.g. re-read a sibling filter's cookie)
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = `filter-${useId().replace(/:/g, "")}`;

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Outside-click + Escape + focus-trap while open. Escape and outside-click both restore focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const f = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Move focus into the panel when it opens (first focusable = the search box, matching the old autoFocus),
  // and notify the caller so it can sync sibling state (e.g. the campaign list to the current objective).
  useEffect(() => {
    if (!open) return;
    onOpen?.();
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={FILTER_TRIGGER}
      >
        {pending ? (
          <span className="flex items-center gap-1.5 text-[var(--accent)]">
            <span className="h-1.5 w-1.5 motion-safe:animate-pulse rounded-full bg-[var(--accent)]" />
            Updating...
          </span>
        ) : (
          <>
            <span className={FILTER_LABEL}>{label}</span> <span className="max-w-[150px] truncate">{summary}</span>
          </>
        )}
        <span className={FILTER_LABEL} aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={dialogLabel ?? label}
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-[calc(100%+6px)] z-30 ${width} rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-lg`}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}
