import type { NextConfig } from "next";

// Content-Security-Policy in REPORT-ONLY mode: it never blocks anything (zero risk of breaking the
// app), it only reports what an enforced policy would catch. This is the correct launch step -
// validate against real traffic first, then flip to enforced later. Origins the browser legitimately
// uses: Next inline hydration scripts/styles, Google Fonts, Supabase auth/realtime, and ad-thumbnail
// images from various CDNs (https:). Server-side calls (Meta/Gemini) don't go through the browser, so
// they are not in connect-src.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Baseline security headers applied to every response (Vercel honors next.config headers, no
// vercel.json needed).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
