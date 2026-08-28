import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Public lead capture for the /book-demo form. No auth (it is a marketing form), so it is
// deliberately narrow: validate the email, cap every field length, and drop obvious bots via a
// honeypot. Writes through the service-role admin client into demo_requests (RLS deny-by-default,
// so the row is never publicly readable).
// ponytail: no IP rate-limit yet (needs edge/middleware infra); honeypot + length caps are the
// ceiling. Add per-IP throttling before this sees real spam volume.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cap = (v: unknown, n: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, n) : null;
};

export async function POST(request: NextRequest) {
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
