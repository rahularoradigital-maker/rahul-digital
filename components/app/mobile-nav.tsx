"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/site-header";

// Mobile navigation: the desktop sidebar is hidden below md, which left phones with NO nav
// at all. This adds a hamburger (md:hidden) that opens the same nav as a slide-in drawer,
// reusing SidebarNav so the menu never drifts from desktop. Closes on route change, on the
// backdrop, and on Escape.
function initials(email?: string): string {
  if (!email) return "AB";
  const parts = email.split(/[.@_-]/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "AB";
}

export function MobileNav({ userEmail }: { userEmail?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close whenever the route changes (a nav item was tapped).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll + close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="shrink-0 rounded-lg p-2.5 text-[var(--ink)] transition hover:bg-[var(--surface-alt)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] md:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-[var(--surface)] px-3.5 py-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Link href="/app" className="flex items-center gap-2.5 px-2 py-1.5 text-[17px] font-semibold">
                <Logo />
                AdBrain AI
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 text-[var(--ink-muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <SidebarNav />

            <div className="mt-4 flex items-center gap-2.5 border-t border-[var(--hairline)] pt-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[13px] font-semibold text-white">
                {initials(userEmail)}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[13px] font-medium">{userEmail ?? "Signed in"}</div>
                <form action={signOut}>
                  <button className="text-xs text-[var(--ink-muted)] transition hover:text-[var(--ink)]">Sign out</button>
                </form>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
