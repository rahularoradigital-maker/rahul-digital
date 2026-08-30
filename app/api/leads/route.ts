import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/rate-limit-distributed";

// Public lead capture for the /book-demo form. No auth (it is a marketing form), so it is
// deliberately narrow: bound the abuse surface (IP rate-limit + body-size cap), validate the email,
// cap every field length, and drop obvious bots via a honeypot. Writes through the service-role
// admin client into demo_requests (RLS deny-by-default, so the row is never publicly readable).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cap = (v: unknown, n: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, n) : null;
};
// At most 8 submissions per IP per 10 minutes (a real person submits once). Distributed across instances
// when Upstash is configured, else per-instance (see lib/rate-limit-distributed.ts).
const RL = { windowMs: 600_000, max: 8 };
const clientIp = (request: NextRequest): string =>
  (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";

export async function POST(request: NextRequest) {
  // Reject an oversized body before parsing it (cheap DoS guard); the form payload is tiny.
  if (Number(request.headers.get("content-length") ?? 0) > 10_000) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }
  if ((await enforceRateLimit(clientIp(request), RL)).limited) {
    return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: a hidden field real users never fill. A bot that fills it gets a fake success.
  if (cap(body.company_website, 200)) return NextResponse.json({ ok: true });

  const email = cap(body.email, 200);
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });
  }

  const row = {
    first_name: cap(body.first_name, 100),
    last_name: cap(body.last_name, 100),
    email,
    brand: cap(body.brand, 200),
    spend_bucket: cap(body.spend_bucket, 40),
    notes: cap(body.notes, 2000),
    source: cap(body.source, 60) ?? "book-demo",
  };

  try {
    const { error } = await createAdminClient().from("demo_requests").insert(row);
    if (error) return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not save. Please try again." }, { status: 500 });
  }
}
