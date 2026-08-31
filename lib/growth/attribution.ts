// Attribution foundation (spec section 22). Every link back to AdBrain that Scout puts in a reply or an
// article is UTM-tagged, so when someone clicks -> lands -> signs up, the source (platform / community / topic)
// is traceable. Pure - unit-testable (scripts/check-attribution-utm.ts). The signup-capture half (reading
// utm_* on landing and tying it to the signup event) is wired separately in the app's auth flow.

import { BRAND } from "./knowledge.ts";

const SITE = BRAND.url.replace(/\/$/, ""); // https://adscaledigital.co

// Build a UTM-tagged AdBrain URL. source = the platform/community; content = the topic or conversation id.
export function utmLink(path: string, opts: { source: string; content?: string; campaign?: string; medium?: string }): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const u = new URL(SITE + p);
  u.searchParams.set("utm_source", clean(opts.source));
  u.searchParams.set("utm_medium", clean(opts.medium ?? "scout"));
  u.searchParams.set("utm_campaign", clean(opts.campaign ?? "growth"));
  if (opts.content) u.searchParams.set("utm_content", clean(opts.content));
  return u.toString();
}
function clean(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "scout";
}

// Post-process markdown/text: any bare or markdown link to adscaledigital.co gets UTMs appended (unless it
// already carries a utm_source). Idempotent. This makes every product link Scout writes attributable, without
// the AI having to remember the tags.
export function tagAdBrainLinks(text: string, opts: { source: string; content?: string }): string {
  const host = SITE.replace(/^https?:\/\//, "");
  const urlRe = new RegExp(`https?://(?:www\\.)?${host.replace(/\./g, "\\.")}[^\\s)\\]]*`, "gi");
  return text.replace(urlRe, (raw) => {
    if (/[?&]utm_source=/.test(raw)) return raw; // already tagged
    try {
      const u = new URL(raw);
      u.searchParams.set("utm_source", clean(opts.source));
      u.searchParams.set("utm_medium", "scout");
      u.searchParams.set("utm_campaign", "growth");
      if (opts.content) u.searchParams.set("utm_content", clean(opts.content));
      return u.toString();
    } catch {
      return raw;
    }
  });
}
