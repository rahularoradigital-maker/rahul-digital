// Small reusable "how old is this?" formatter (PURE). Several screens show data with a timestamp but never
// tell the user how old it is - presenting a 3-week-old influencer run as if it were current (a §24 freshness
// violation). This turns an ISO string into an honest relative label, and switches to an ABSOLUTE date once
// something is old enough that "N days ago" stops being meaningful (honesty over false immediacy).

export function daysSince(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const ms = Math.max(0, now - t);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  // Beyond a month, "45 days ago" reads as noise - show the real date instead.
  return `on ${new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}
