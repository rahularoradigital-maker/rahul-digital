// SSRF guard for server-side fetches of EXTERNALLY-SOURCED URLs (competitor/ad image + thumb URLs, Shopify
// product images). Without this, a crafted record pointing at http://169.254.169.254/ (cloud metadata),
// localhost, or an internal host would make our serverless function issue that request. We require https,
// block IP literals in private/loopback/link-local ranges, block known metadata hostnames, and resolve the
// hostname to ensure every A/AAAA record is public (defeats DNS-rebinding to an internal IP).
// NOTE: intentionally NOT "server-only" - node:dns is a Node builtin and this is imported only by server code
// + a plain-Node check (scripts/check-ssrf.ts). It reads no secrets.
import dns from "node:dns/promises";

// True if the IP is in a private / loopback / link-local / CGNAT / unspecified range (i.e. NOT safe to fetch).
export function isPrivateIp(ip: string): boolean {
  const l = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (l.includes(":")) {
    // IPv6
    if (l === "::1" || l === "::") return true;
    if (l.startsWith("fc") || l.startsWith("fd")) return true; // fc00::/7 unique-local
    if (/^fe[89ab]/.test(l)) return true; // fe80::/10 link-local
    const mapped = l.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/); // IPv4-mapped ::ffff:a.b.c.d
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  const p = l.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed -> unsafe
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}

// Reject non-https, IP-literal-private, and known-metadata hosts synchronously (no DNS). Exposed for tests.
export function urlIsSyntacticallyUnsafe(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return true;
  }
  if (u.protocol !== "https:") return true;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal") return true;
  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  if (isIpLiteral && isPrivateIp(host)) return true;
  return false;
}

// Full check: syntactic guard, then DNS-resolve the hostname and require every address to be public.
export async function isPublicHttpsUrl(raw: string): Promise<boolean> {
  if (urlIsSyntacticallyUnsafe(raw)) return false;
  const host = new URL(raw).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return true; // public IP literal (already vetted)
  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}
