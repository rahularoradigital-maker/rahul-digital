import { captureError } from "@/lib/observability";

// Next.js calls onRequestError for every uncaught server-side error (route handlers, RSC, server actions),
// in both the Node and Edge runtimes. This is the single, central place server errors are captured, so we
// never have to touch individual routes - and it is exactly where a Sentry hook would attach later. See
// lib/observability.ts for the swap point.
export function onRequestError(err: unknown, request: { path?: string; method?: string }, context: { routerKind?: string; routePath?: string }) {
  captureError(err, { path: request?.path, method: request?.method, routePath: context?.routePath, routerKind: context?.routerKind });
  // Also persist a compact 'problem' event so the owner console shows what's breaking (which route, why).
  // Dynamic import so this server-only module never loads statically in the edge runtime.
  const feature = context?.routePath ?? request?.path ?? "unknown";
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
  void import("@/lib/owner/events").then((m) => m.logEvent("error", { feature, meta: { message, method: request?.method } })).catch(() => {});
}

// register() is required for an instrumentation file even when we only use onRequestError.
export async function register() {}
