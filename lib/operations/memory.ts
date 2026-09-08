import "server-only";
import { getAccountRules } from "./rules-store.ts";
import { selectMemory, type SelectedMemory } from "./rules.ts";
import type { Operation } from "./types.ts";

// Stage 3 of the spine: "Skills & Advertising Memory, loaded when relevant." Given an interpreted Operation,
// load the account's rules and return ONLY the slice this operation needs (via the pure selectMemory) plus the
// history keys the dispatcher (A3) will fetch. Kept thin on purpose: A2 owns rules + relevance; the actual
// history join happens in A3 where the purpose-built tool already pulls it, so we do not duplicate the fetch.
export async function loadAdvertisingMemory(userId: string, account: string, operation: Operation): Promise<SelectedMemory> {
  const rules = await getAccountRules(userId, account);
  return selectMemory(operation, rules);
}
