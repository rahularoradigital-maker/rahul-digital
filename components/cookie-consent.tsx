"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getConsent, setConsent } from "@/lib/analytics/consent";

// Cookie consent banner. Shows on every public page (never inside /app) until the visitor makes a choice,
// which is then remembered. Consent GATES analytics: only "Accept" lets Google Analytics load (and GA only
// exists when NEXT_PUBLIC_GA_ID is configured); "Decline" keeps the site cookie-free, and the first-party
// analytics never uses cookies either way. Renders nothing until it decides to appear (no layout shift, no
// flash on the server-rendered page).
export function CookieConsent() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/app")) return; // the signed-in product isn't tracked in GA anyway
    if (getConsent() !== null) return; // already chose
    setShow(true);
  }, [pathname]);

  if (!show) return null;

  function choose(v: "granted" | "denied") {
    setConsent(v);
    setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 100,
        background: "var(--surface, #fff)", color: "var(--ink, #252525)",
        borderTop: "1px solid var(--hairline, #e4e4e4)",
        boxShadow: "0 -8px 30px rgba(37,37,37,.10)",
        font: "14px/1.55 Inter, system-ui, sans-serif",
      }}
    >
      {/* Centered inner row so the bar spans the full width but the content stays readable on wide screens. */}
      <div
        style={{
          maxWidth: "1180px", margin: "0 auto", padding: "18px 24px",
          display: "flex", gap: "16px 28px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, flex: "1 1 420px", color: "var(--ink-muted, #6b6b6b)", maxWidth: "70ch" }}>
          We&rsquo;d like to use a cookie for analytics, only if you allow it, to understand how the site is used and
          improve it. Decline and the site stays completely cookie-free.{" "}
          <Link href="/privacy" style={{ color: "var(--accent, #0a66c2)", textDecoration: "underline" }}>
            Privacy policy
          </Link>
        </p>
        <div style={{ display: "flex", gap: "10px", flex: "0 0 auto" }}>
          <button
            onClick={() => choose("denied")}
            style={{
              font: "inherit", fontWeight: 500, cursor: "pointer", padding: "10px 22px",
              borderRadius: "8px", border: "1px solid var(--hairline, #e4e4e4)",
              background: "var(--surface, #fff)", color: "var(--ink, #252525)",
            }}
          >
            Decline
          </button>
          <button
            onClick={() => choose("granted")}
            style={{
              font: "inherit", fontWeight: 500, cursor: "pointer", padding: "10px 22px",
              borderRadius: "8px", border: "1px solid transparent",
              background: "var(--ink, #252525)", color: "#fff",
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
