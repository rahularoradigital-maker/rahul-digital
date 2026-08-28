import type { NextConfig } from "next";

// Baseline security headers applied to every response (Vercel honors next.config headers, no
// vercel.json needed). CSP is deliberately NOT set here: a wrong policy would break the Supabase /
// Meta OAuth / Anthropic cross-origin calls, so it must be introduced report-only and tested
// against a live deploy first. These five are safe, universal hardening.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
