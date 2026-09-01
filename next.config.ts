import type { NextConfig } from "next";

// Content-Security-Policy, ENFORCED (ISSUE 16). It ran in report-only mode first and collected zero
// violations across the public and signed-in pages, so enforcing the SAME directives cannot break a
// legitimate flow while it makes the protections real: connect-src pins network calls to self +
// Supabase (blocks exfil to other origins), object-src 'none' / base-uri / form-action / frame-
// ancestors close clickjacking + form-hijack + base-tag vectors. Origins the browser legitimately
// uses: Next inline hydration scripts/styles, Google Fonts, Supabase auth/realtime, and ad-thumbnail
// images from various CDNs (https:). Server-side calls (Meta/Gemini) don't go through the browser, so
// they are not in connect-src. ponytail: script-src still carries 'unsafe-inline' because Next's
// hydration bootstrap is inline; removing it needs a nonce/hash strategy - a tracked follow-up, not a
// blocker for enforcing the rest.
export const csp = [
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
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // 301s that consolidate authority instead of leaving cannibalizing/dead URLs. The old auto-generated
  // fatigue post competed with the canonical Meta fatigue guide for the same term; redirect it (and the old
  // row is archived so it also leaves the index + sitemap).
  async redirects() {
    return [
      {
        source: "/blog/understanding-and-combating-creative-fatigue-in-digital-advertising",
        destination: "/blog/meta-ad-creative-fatigue",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
