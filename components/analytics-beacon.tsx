"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isTrackablePath, isBlogPost } from "@/lib/analytics/classify";

// First-party pageview + blog-read beacon. Renders nothing. Fires a "view" on every public page (re-firing on
// client-side navigation via usePathname), and on a blog POST also fires a "read" once the visitor actually
// engages - scrolls past halfway OR stays 15s - so "reads" measure real reading, not bounces. NO cookies / no
// storage; the server derives an anonymous daily visitor hash. Never throws into the page.
export function AnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !isTrackablePath(pathname)) return;

    function send(event: "view" | "read") {
      const body = JSON.stringify({ path: pathname, event });
      try {
        if (navigator.sendBeacon) navigator.sendBeacon("/api/analytics", body);
        else void fetch("/api/analytics", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
      } catch {
        /* telemetry must never break the page */
      }
    }

    send("view");

    // Blog "read": fire once when the reader engages (>=50% scrolled, or 15s dwell), whichever comes first.
    if (!isBlogPost(pathname)) return;
    let done = false;
    function markRead() {
      if (done) return;
      done = true;
      send("read");
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    }
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0 || (window.scrollY + window.innerHeight) / doc.scrollHeight >= 0.5) markRead();
    }
    const timer = setTimeout(markRead, 15_000);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
