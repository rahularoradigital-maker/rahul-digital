// PURE (no server-only, no I/O) so the gate exercises it and both the client beacon and the API route reuse
// the same rules. Classifies which paths are website traffic worth counting, spots blog posts, and normalizes
// a referrer to just its host (never a full URL / query - privacy + low-cardinality).

// Count PUBLIC website + blog traffic only. Exclude the signed-in product (/app), the API, Next internals,
// and static assets - those are not "website visitors".
export function isTrackablePath(path: string): boolean {
  if (!path || path[0] !== "/") return false;
  if (path.startsWith("/app")) return false;      // the signed-in product, not the website
  if (path.startsWith("/api")) return false;
  if (path.startsWith("/_next")) return false;
  if (/\.[a-z0-9]+$/i.test(path)) return false;    // a file (favicon, og image, sitemap.xml, etc.)
  return true;
}

// A blog POST is /blog/<slug> (not the /blog index itself).
export function isBlogPost(path: string): boolean {
  return /^\/blog\/[^/]+\/?$/.test(path);
}

export function blogSlug(path: string): string | null {
  const m = path.match(/^\/blog\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Strip a full Referer down to its host for a clean "top sources" list; own-site + empty referrers become
// "direct". `selfHost` is the site's own host so internal navigation isn't counted as a referral.
export function refHost(referer: string | null | undefined, selfHost?: string | null): string {
  if (!referer) return "direct";
  try {
    const h = new URL(referer).hostname.replace(/^www\./, "");
    if (selfHost && h === selfHost.replace(/^www\./, "")) return "direct";
    return h || "direct";
  } catch {
    return "direct";
  }
}

// A path stored from a beacon: pathname only, query stripped, length-bounded (a hostile beacon can't write a
// huge blob or smuggle a query string into the table).
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  const p = raw.split("?")[0].split("#")[0].slice(0, 256);
  return p[0] === "/" ? p : null;
}
