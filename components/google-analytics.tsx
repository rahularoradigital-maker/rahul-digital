"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isTrackablePath } from "@/lib/analytics/classify";
import { hasAnalyticsConsent, CONSENT_EVENT } from "@/lib/analytics/consent";

// GA4 (gtag.js), env-gated AND consent-gated. Renders NOTHING unless NEXT_PUBLIC_GA_ID is set (no-op until you
// paste your Measurement ID into Vercel) AND the visitor has accepted cookies (see CookieConsent). GA4 sets
// cookies, so it must never load before consent - this makes the cookie banner load-bearing, not decorative.
// We disable GA's automatic page_view and send it ourselves ONLY for public website/blog paths (isTrackablePath),
// so the signed-in product (/app) is never sent to Google - matching the cookie-free first-party tracker's scope.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function GoogleAnalytics() {
  const pathname = usePathname();
  // Only mount gtag once consent is granted. Re-check when the banner dispatches a consent decision.
  const [consented, setConsented] = useState(false);
  useEffect(() => {
    if (!GA_ID) return;
    setConsented(hasAnalyticsConsent());
    const onConsent = () => setConsented(hasAnalyticsConsent());
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  useEffect(() => {
    if (!GA_ID || !consented || typeof window === "undefined" || !window.gtag) return;
    if (!isTrackablePath(pathname)) return; // never send /app, /api, files to GA
    window.gtag("event", "page_view", { page_path: pathname });
  }, [pathname, consented]);

  if (!GA_ID || !consented) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${GA_ID}', { send_page_view: false });`}
      </Script>
    </>
  );
}
