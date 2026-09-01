"use client";

import { useEffect, useState } from "react";

// UX: a "back to top" affordance for long cockpit/leaderboard pages. Appears only after the viewer has
// scrolled a screenful, respects prefers-reduced-motion, and is keyboard-reachable. Mounted once in the
// app shell so every /app page gets it for free - no per-page wiring.
export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      className="fixed bottom-5 right-5 z-40 grid h-10 w-10 place-items-center rounded-full border border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink)] shadow-md transition hover:bg-[var(--bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 12V4M8 4L4 8M8 4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
