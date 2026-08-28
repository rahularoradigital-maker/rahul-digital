// One time-bounded fetch, shared by the outbound integrations (Gemini, ScrapeCreators). A hung image
// CDN or a stalled upstream socket would otherwise pin a serverless invocation until the platform
// kills it - a hard 504 for the user, and at 1000 users, exhausted concurrency. Aborts after `ms`;
// callers treat the throw (an AbortError) as "this call failed" and degrade to null / rethrow.
// (meta-source's graphGet keeps its own copy because its timeout is fused with retry+backoff.)
export async function fetchWithTimeout(url: string | URL, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
