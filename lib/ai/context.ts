// Per-request context for AI-cost attribution. AI calls run deep inside helper chains that don't carry
// userId/task, so we stash them in AsyncLocalStorage: userId at the route boundary, task per router call.
// Read at spend-recording time. Node runtime only; each serverless request has its own async context, so
// this never leaks across requests, and within one request the router's calls are sequential.
import { AsyncLocalStorage } from "node:async_hooks";

type AiCtx = { userId: string | null; task: string | null };
const store = new AsyncLocalStorage<AiCtx>();

// Bind the user for the rest of THIS request's async execution (call at the top of an AI route, after getUser).
export function setAiUser(userId: string | null): void {
  const s = store.getStore();
  store.enterWith({ userId, task: s?.task ?? null });
}

// The router sets the task right before each provider call.
export function setAiTask(task: string): void {
  const s = store.getStore();
  store.enterWith({ userId: s?.userId ?? null, task });
}

export function currentAiUserId(): string | null {
  return store.getStore()?.userId ?? null;
}

export function currentAiTask(): string | null {
  return store.getStore()?.task ?? null;
}
