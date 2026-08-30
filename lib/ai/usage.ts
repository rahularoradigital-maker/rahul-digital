// Note: intentionally NOT "server-only" - it sits in the AI router's import graph, which the check:ai gate
// loads in plain Node. It is node-safe (only process.env + fetch) and only ever imported by server code;
// the Upstash creds it reads are non-public env, so nothing can leak client-side regardless.
import { upstash } from "../upstash.ts";

// Best-effort per-day AI-call counter for cost visibility, backed by Upstash when configured (a shared
// counter across all serverless instances). Fire-and-forget: it never blocks or fails an AI call. With no
// Upstash configured it is a silent no-op (cost tracking simply off). Cost proxy = calls x per-call price;
// the daily budget alarm reads this in the cron.
// ponytail: counts one INCR per provider call (so a 60-ad vision run adds ~60 fire-and-forget INCRs). Fine
// at current scale; batch per-run if Upstash call volume ever matters.

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function recordAiCall(): void {
  const key = `aiusage:${today()}`;
  // Fire-and-forget: INCR, and on the first hit of the day set a 2-day TTL so keys self-expire.
  void upstash(["INCR", key]).then((v) => {
    if (v === 1) void upstash(["EXPIRE", key, 172_800]);
  });
}

export async function getAiCallsToday(): Promise<number> {
  const v = await upstash(["GET", `aiusage:${today()}`]);
  return v == null ? 0 : Number(v);
}
