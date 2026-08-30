// Central error capture. Isomorphic (server + client), no external dependency. Today it emits ONE
// structured JSON line per error to the platform logs (Vercel captures these), which is greppable and
// carries context. It is the single seam to swap for a real error tracker: when a Sentry DSN is added,
// replace the body of captureError with `Sentry.captureException(err, { extra: context })` and nothing
// else in the app changes. Never include secrets or full user PII in `context`.

export function captureError(err: unknown, context: Record<string, unknown> = {}): void {
  const e =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { message: String(err) };
  try {
    // ponytail: structured console is the floor (Vercel log drains can ship it); swap for Sentry when a
    // DSN exists. Kept in a try so logging can never throw and mask the original error.
    console.error(JSON.stringify({ level: "error", at: new Date().toISOString(), err: e, ...context }));
  } catch {
    console.error("[observability] captureError failed to serialize", e.message);
  }
}
