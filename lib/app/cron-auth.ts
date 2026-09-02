import { timingSafeEqual } from "node:crypto";

// Bearer-secret auth for scheduled/internal routes, as ONE primitive (Phase-0 audit P1). The identical
// constant-time compare was hand-copied into /api/cron/sync, /api/cron/growth and /api/jobs/drain; three
// copies of an auth check is three places for a subtle regression. Semantics are unchanged:
//   - CRON_SECRET unset  -> 503 (the route is inert; never a public, unauthenticated way to make the app work)
//   - header mismatch    -> 401
//   - lengths compared first because timingSafeEqual throws on unequal lengths; then constant-time so the
//     secret can't be recovered via response timing.
// Usage: `export const GET = withCronSecret(async (request, secret) => { ... })` - the verified secret is
// handed to the handler for the self-chaining "continue hop" that needs to re-present it.

export function cronSecretGate(request: Request): { ok: true; secret: string } | { ok: false; response: Response } {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, response: Response.json({ error: "CRON_SECRET is not configured." }, { status: 503 }) };
  const presented = request.headers.get("authorization") ?? "";
  const a = Buffer.from(presented);
  const b = Buffer.from(`Bearer ${secret}`);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  return { ok: true, secret };
}

export function withCronSecret(handler: (request: Request, secret: string) => Promise<Response> | Response) {
  return async (request: Request): Promise<Response> => {
    const gate = cronSecretGate(request);
    if (!gate.ok) return gate.response;
    return handler(request, gate.secret);
  };
}
