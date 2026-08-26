// Client-safe constants for the date-window setup gate (rulebook 5A). Kept in its
// own module with NO server imports so client components (the topbar) can use it
// without pulling in next/headers via the data loader.

export const WINDOWS = [7, 14, 30, 60, 90] as const;

/** Parse a ?days= query value into an allowed window, defaulting to 30. */
export function parseDays(value?: string | string[]): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return (WINDOWS as readonly number[]).includes(n) ? n : 30;
}
