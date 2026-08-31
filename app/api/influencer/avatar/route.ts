import { NextResponse } from "next/server";

// Image proxy for creator profile pictures. Instagram's CDN blocks hotlinking (a browser <img> to it usually
// 403s), but a server-side fetch is served fine - so we proxy the bytes. SSRF-safe: ONLY Instagram/Facebook
// CDN https hosts are allowed, nothing else, so this can never be used to fetch arbitrary internal URLs.

const ALLOWED_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

export async function GET(request: Request) {
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
    const res = await fetch(target, { headers: { "User-Agent": "Mozilla/5.0 (compatible; AdBrain/1.0)" }, signal: AbortSignal.timeout(8000) });
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || !ct.startsWith("image/")) return new NextResponse(null, { status: 404 });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, { status: 200, headers: { "Content-Type": ct, "Cache-Control": "public, max-age=86400" } });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
