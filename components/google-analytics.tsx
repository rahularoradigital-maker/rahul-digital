"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isTrackablePath } from "@/lib/analytics/classify";

// GA4 (gtag.js), env-gated. Renders NOTHING unless NEXT_PUBLIC_GA_ID is set, so it is a no-op until you paste
// your Measurement ID (G-XXXXXXXXXX) into Vercel. We disable GA's automatic page_view (send_page_view:false)
// and send page_view ourselves ONLY for public website/blog paths (reusing isTrackablePath), so the signed-in
// product (/app) is never sent to Google - it stays out of GA, matching the first-party tracker's scope.
// Note: GA4 sets cookies; if you serve EU visitors you may need a consent banner (this loads it unconditionally
// when configured - swap to load-on-consent if that applies to you).

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
    if (!isTrackablePath(pathname)) return; // never send /app, /api, files to GA
    window.gtag("event", "page_view", { page_path: pathname });
  }, [pathname]);

  if (!GA_ID) return null;

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
