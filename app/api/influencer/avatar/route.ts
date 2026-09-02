import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit-distributed";

// Image proxy for creator profile pictures. Instagram's CDN blocks hotlinking (a browser <img> to it usually
// 403s), but a server-side fetch is served fine - so we proxy the bytes. SSRF-safe: ONLY Instagram/Facebook
// CDN https hosts are allowed, nothing else, so this can never be used to fetch arbitrary internal URLs.
//
// Security (P0): this was unauthenticated, unlimited and uncapped - a free egress amplifier / anonymising
// proxy (anyone could make our function fetch + buffer arbitrary IG-CDN objects on our bandwidth and IP).
// Every caller lives inside /app, so requiring a session costs nothing; a per-user rate limit and a byte
// cap bound the worst case.

const ALLOWED_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;
const MAX_BYTES = 2 * 1024 * 1024; // avatars are small; anything larger is not an avatar
const RATE = { windowMs: 60_000, max: 120 }; // generous for a grid of creator cards, tight against abuse

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const rl = await enforceRateLimit(`avatar:${user.id}`, RATE);
  if (rl.limited) return new NextResponse(null, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });

  const raw = new URL(request.url).searchParams.get("u");
  if (!raw) return new NextResponse(null, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  // Allowlist: https + an Instagram/Facebook CDN host only. Reject everything else (no SSRF).
  if (target.protocol !== "https:" || !ALLOWED_HOST.test(target.hostname)) return new NextResponse(null, { status: 400 });

  try {
    const res = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 (compatible; AdScale/1.0)" }, signal: AbortSignal.timeout(8000) });
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || !ct.startsWith("image/")) return new NextResponse(null, { status: 404 });
    // Byte cap: refuse on the declared size before buffering, and again on the real size after.
    if (Number(res.headers.get("content-length") || 0) > MAX_BYTES) return new NextResponse(null, { status: 413 });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return new NextResponse(null, { status: 413 });
    return new NextResponse(buf, { status: 200, headers: { "Content-Type": ct, "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
