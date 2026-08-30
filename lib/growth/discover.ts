// FREE, no-touch discovery (spec sections 4, 5). Reddit exposes a public read-only JSON search that needs NO
// auth and NO key - the honest free source. We fetch, normalize to the shared Conversation object, and compute
// the opportunity factors heuristically (deterministic, documented). Respects a polite rate (one request per
// query with a User-Agent, sequential) - never a scraper flood. Other sources (Quora/LinkedIn/X) plug in here
// behind the same Conversation shape when a compliant connector is added.

import type { Conversation, OppFactors } from "./engine.ts";
import { matchIntent } from "./engine.ts";
import { SEED_SUBREDDITS } from "./knowledge.ts";

type RedditChild = { data: { id: string; subreddit: string; author: string; permalink: string; created_utc: number; title: string; selftext: string; num_comments: number; over_18: boolean } };

// One polite public search against a subreddit. Read-only, no auth. Returns [] on any failure (best-effort).
async function searchSub(sub: string, query: string, limit: number): Promise<Conversation[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=${limit}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "AdScaleGrowthAgent/1.0 (read-only listening; contact adscaledigital.co)" } });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { children?: RedditChild[] } };
    return (json.data?.children ?? [])
      .filter((c) => !c.data.over_18)
      .map((c) => ({
        conversationId: `reddit:${c.data.id}`,
        platform: "reddit",
        community: `r/${c.data.subreddit}`,
        author: c.data.author ?? null,
        url: `https://www.reddit.com${c.data.permalink}`,
        timestamp: new Date(c.data.created_utc * 1000).toISOString(),
        content: `${c.data.title}\n\n${c.data.selftext ?? ""}`.trim(),
        title: c.data.title,
        question: /\?|\bhow\b|\bwhen\b|\bshould\b|\bwhy\b/i.test(c.data.title),
      }));
  } catch {
    return [];
  }
}

// Discover across the seed communities for a set of intent queries. De-duplicated by conversationId (section 5).
export async function discoverReddit(queries: string[], subs: readonly string[] = SEED_SUBREDDITS, perQuery = 8): Promise<Conversation[]> {
  const seen = new Set<string>();
  const out: Conversation[] = [];
  for (const sub of subs) {
    for (const q of queries) {
      const batch = await searchSub(sub, q, perQuery);
      for (const c of batch) if (!seen.has(c.conversationId)) (seen.add(c.conversationId), out.push(c));
    }
  }
  return out;
}

// Hacker News via the Algolia API - genuinely FREE, no auth, no key, works from a server (Reddit's public JSON
// now 403s unauthenticated server requests, so this is the honest zero-touch source). Stories + comments that
// match our intent queries. De-duplicated by objectID.
type HnHit = { objectID: string; title?: string; url?: string; author?: string; created_at?: string; story_text?: string; comment_text?: string; num_comments?: number };
export async function discoverHN(queries: string[], perQuery = 15): Promise<Conversation[]> {
  const seen = new Set<string>();
  const out: Conversation[] = [];
  for (const q of queries) {
    try {
      const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=(story,comment)&hitsPerPage=${perQuery}`);
      if (!res.ok) continue;
      const json = (await res.json()) as { hits?: HnHit[] };
      for (const h of json.hits ?? []) {
        const id = `hn:${h.objectID}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const content = `${h.title ?? ""}\n\n${h.story_text ?? h.comment_text ?? ""}`.trim();
        if (!content) continue;
        out.push({
          conversationId: id,
          platform: "hackernews",
          community: "Hacker News",
          author: h.author ?? null,
          url: `https://news.ycombinator.com/item?id=${h.objectID}`,
          timestamp: h.created_at ?? new Date().toISOString(),
          content,
          title: h.title,
          question: /\?|\bhow\b|\bwhen\b|\bshould\b|\bwhy\b/i.test(content),
        });
      }
    } catch {
      /* best-effort per query */
    }
  }
  return out;
}

// --- Deterministic factor extraction (documented heuristics). AI can later refine, but the base is auditable.
const STRONG_COMMUNITIES = new Set(["r/PPC", "r/FacebookAds", "r/GoogleAds", "r/advertising"]);
const SEVERITY = /(tanked|collapsed|dropped|plummeted|wasting|burning|broken|dying|help|desperate|urgent)/i;
const COMMERCIAL = /(budget|spend|\$\d|agency|tool|software|subscri|pricing|vs |alternative|switch)/i;
const RISK_WORDS = /(politic|nsfw|lawsuit|scam|hate|banned|drama|rant)/i;

export function factorsFor(conv: Conversation, nowMs: number): OppFactors {
  const text = conv.content.toLowerCase();
  const m = matchIntent(text);
  const ageH = (nowMs - Date.parse(conv.timestamp)) / 3_600_000;
  const recency = ageH < 24 ? 1 : ageH < 72 ? 0.7 : ageH < 168 ? 0.4 : 0.2;
  const commercialIntent = COMMERCIAL.test(text) ? 0.65 : conv.question ? 0.35 : 0.25;
  const problemSeverity = SEVERITY.test(text) ? 0.85 : m.matched ? 0.5 : 0.3;
  const communityQuality = STRONG_COMMUNITIES.has(conv.community) ? 0.85 : 0.5;
  const audienceFit = STRONG_COMMUNITIES.has(conv.community) ? 0.8 : 0.55;
  const intent = m.matched ? (conv.question ? 0.8 : 0.6) : conv.question ? 0.4 : 0.25;
  const relevance = m.matched ? 0.6 + 0.4 * m.fit : 0.2;
  const competition = 0.5; // without comment depth per-thread, assume moderate room; refined when we read the thread
  const risk = RISK_WORDS.test(text) ? 0.6 : 0.2;
  return { relevance, intent, solutionFit: m.fit, commercialIntent, audienceFit, problemSeverity, recency, communityQuality, competition, risk };
}
