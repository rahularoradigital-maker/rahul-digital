"use client";

import { useEffect } from "react";

// S6 (scale plan): real-user Core Web Vitals collector. NO dependency (native PerformanceObserver + Navigation
// Timing), so it adds nothing to the bundle beyond this tiny component. It captures the read-path metrics that
// matter for "is the dashboard fast at scale" - LCP (largest paint), FCP (first paint), TTFB (server response),
// CLS (layout stability) - and beacons each ONCE on page hide via navigator.sendBeacon, so it never competes
// with the page for network or delays anything. Renders nothing.
//
// ponytail: INP (interaction latency) needs full event attribution to measure correctly; the web-vitals lib
// does it properly. We deliberately capture the load metrics natively here rather than half-measure INP - add
// the web-vitals package later if INP field data is needed (the /api/vitals sink already accepts "INP").

export function VitalsReporter() {
  useEffect(() => {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

    const path = window.location.pathname;
    const sent = new Set<string>(); // one beacon per metric per page view
    let cls = 0; // CLS accumulates across the page's life; flushed on hide

    function send(name: string, value: number) {
      if (sent.has(name)) return;
      sent.add(name);
      const body = JSON.stringify({ name, value, path });
      // sendBeacon survives the page unload; fall back to a keepalive fetch if it is unavailable.
      try {
        if (navigator.sendBeacon) navigator.sendBeacon("/api/vitals", body);
        else void fetch("/api/vitals", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
      } catch {
        /* never let telemetry throw into the app */
      }
    }

    const observers: PerformanceObserver[] = [];
    function observe(type: string, cb: (entries: PerformanceEntryList) => void) {
      try {
        const po = new PerformanceObserver((list) => cb(list.getEntries()));
        po.observe({ type, buffered: true } as PerformanceObserverInit);
        observers.push(po);
      } catch {
        /* unsupported entry type on this browser - skip that metric */
      }
    }

    // LCP: keep the latest candidate; report it at hide time (the last one before the user leaves is final).
    let lcp = 0;
    observe("largest-contentful-paint", (entries) => {
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (last) lcp = last.startTime;
    });
    // FCP: first-contentful-paint from the paint timeline (fire-once as soon as it lands).
    observe("paint", (entries) => {
      for (const e of entries) if (e.name === "first-contentful-paint") send("FCP", e.startTime);
    });
    // CLS: sum layout shifts that were not caused by recent user input (Google's definition).
    observe("layout-shift", (entries) => {
      for (const e of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!e.hadRecentInput) cls += e.value;
      }
    });
    // TTFB: from the navigation entry (responseStart). Available immediately after load.
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav && nav.responseStart > 0) send("TTFB", nav.responseStart);
    } catch {
      /* navigation timing unavailable - skip TTFB */
    }

    // Flush the accumulating metrics (LCP, CLS) when the page is backgrounded/closed - the moment their values
    // are final. visibilitychange->hidden is the reliable signal (pagehide as a belt-and-braces fallback).
    function flush() {
      if (lcp > 0) send("LCP", lcp);
      send("CLS", cls); // CLS of 0 is a real, good value - always report it
    }
    function onHidden() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      for (const po of observers) po.disconnect();
    };
  }, []);

  return null;
}
