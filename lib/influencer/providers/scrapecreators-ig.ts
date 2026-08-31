// ScrapeCreators Instagram adapter. Implements the CreatorDataProvider contract so the discovery pipeline
// never knows it is ScrapeCreators. Two real capabilities: discover (keyword search, cheap - 1 credit) and
// profile (followers + a real engagement rate computed from recent posts). Audience demographics + a public
// engager sample are NOT available from the public IG profile, so this provider does NOT claim them: engagers
// returns [] and every field IG does not expose comes back as UNKNOWN evidence, never a fabricated value.
//
// API shapes are the documented ScrapeCreators responses (docs.scrapecreators.com/v1/instagram/*). Every read
// is guarded so a shape surprise degrades to UNKNOWN instead of crashing the run.

import { fetchWithTimeout } from "@/lib/http";
import { evidence, unknown, type NormalizedCreator, type CreatorIdentity, type CreatorSearchSpec, type EngagerSignal } from "../types";
import type { CreatorDataProvider, ProviderCapability } from "../provider";

const BASE = "https://api.scrapecreators.com/v1/instagram";
const TIMEOUT_MS = 12_000; // per call; with parallel fetches this keeps the whole run under the ~60s cap
const RECENT_POSTS_FOR_ER = 12; // engagement rate is averaged over up to this many recent posts
const DEFAULT_DISCOVER_FLOOR = 10_000; // skip tiny shops/resellers; a real influencer floor (overridable by spec)

const igUrl = (handle: string) => `https://www.instagram.com/${handle}/`;
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// A dead/empty hashtag must not kill the whole run; only a credits/auth failure should propagate.
const isFatal = (e: unknown) => e instanceof Error && /credit|api[- ]?key|unauthor|forbidden|quota/i.test(e.message);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getJson(url: string, apiKey: string): Promise<Record<string, unknown>> {
  const res = await fetchWithTimeout(url, { headers: { "x-api-key": apiKey } }, TIMEOUT_MS);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // ScrapeCreators signals failure with success:false + a message (e.g. "out of credits"). Surface it as a
  // real error so the run reports it honestly rather than silently returning nothing.
  if (body && body.success === false) {
    throw new Error(typeof body.message === "string" ? body.message : `ScrapeCreators request failed (${res.status})`);
  }
  if (!res.ok) throw new Error(`ScrapeCreators HTTP ${res.status}`);
  return body;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Map the documented /profile response to a NormalizedCreator. Missing fields -> UNKNOWN, never faked. */
function mapProfile(identity: CreatorIdentity, body: Record<string, unknown>): NormalizedCreator {
  const at = today();
  const data = (body.data ?? {}) as Record<string, unknown>;
  const u = (data.user ?? {}) as Record<string, unknown>;

  const username = str(u.username) ?? identity.handle;
  const followers = num((u.edge_followed_by as Record<string, unknown> | undefined)?.count);
  const following = num((u.edge_follow as Record<string, unknown> | undefined)?.count);
  const media = (u.edge_owner_to_timeline_media ?? {}) as Record<string, unknown>;
  const postsCount = num(media.count);
  const edges = Array.isArray(media.edges) ? (media.edges as Record<string, unknown>[]) : [];

  // Real engagement rate from recent posts: mean(likes + comments) / followers. Only computed when we have
  // both real post interactions and a real follower base; otherwise UNKNOWN (never a fabricated 0).
  const recent = edges
    .map((e) => (e.node ?? {}) as Record<string, unknown>)
    .slice(0, RECENT_POSTS_FOR_ER)
    .map((n) => ({
      likes: num((n.edge_liked_by as Record<string, unknown> | undefined)?.count) ?? num((n.edge_media_preview_like as Record<string, unknown> | undefined)?.count),
      comments: num((n.edge_media_to_comment as Record<string, unknown> | undefined)?.count),
    }))
    .filter((p) => p.likes !== null || p.comments !== null);

  let avgLikes = unknown<number>();
  let avgComments = unknown<number>();
  let engagementRate = unknown<number>();
  if (recent.length > 0) {
    const likeVals = recent.map((p) => p.likes).filter((x): x is number => x !== null);
    const commentVals = recent.map((p) => p.comments).filter((x): x is number => x !== null);
    const meanLikes = likeVals.length ? likeVals.reduce((a, b) => a + b, 0) / likeVals.length : null;
    const meanComments = commentVals.length ? commentVals.reduce((a, b) => a + b, 0) / commentVals.length : null;
    if (meanLikes !== null) avgLikes = evidence(Math.round(meanLikes), "PROVIDER", "medium", at, `mean over ${likeVals.length} recent posts`);
    if (meanComments !== null) avgComments = evidence(Math.round(meanComments), "PROVIDER", "medium", at, `mean over ${commentVals.length} recent posts`);
    if (followers && followers > 0 && (meanLikes !== null || meanComments !== null)) {
      const er = ((meanLikes ?? 0) + (meanComments ?? 0)) / followers;
      engagementRate = evidence(er, "CALCULATED", "medium", at, `(mean likes + comments)/followers over ${recent.length} recent posts`);
    }
  }

  const isBusiness = u.is_business_account === true;
  const isPro = u.is_professional_account === true;
  const accountType = isBusiness ? "business" : isPro ? "creator" : "personal";

  return {
    identity: { ...identity, handle: username, profileUrl: igUrl(username) },
    name: str(u.full_name) ? evidence(str(u.full_name)!, "PROVIDER", "high", at) : unknown(),
    bio: str(u.biography) ? evidence(str(u.biography)!, "PUBLIC_WEB", "medium", at) : unknown(),
    followers: followers !== null ? evidence(followers, "PROVIDER", "high", at) : unknown(),
    following: following !== null ? evidence(following, "PROVIDER", "high", at) : unknown(),
    postsCount: postsCount !== null ? evidence(postsCount, "PROVIDER", "high", at) : unknown(),
    verified: typeof u.is_verified === "boolean" ? evidence(u.is_verified, "PROVIDER", "high", at) : unknown(),
    accountType: evidence(accountType, "PROVIDER", isBusiness || isPro ? "high" : "low", at),
    creatorCountry: unknown("public IG profile does not expose creator country"),
    creatorLanguage: unknown("public IG profile does not expose creator language"),
    avgLikes,
    avgComments,
    avgViews: unknown("not available from the IG profile endpoint"),
    engagementRate,
    engagementMethod: "(mean likes + comments)/followers over recent posts",
    businessEmail: unknown("public IG profile does not expose a business email"),
    audience: {
      topCountries: [], genderLean: null, topLanguages: [], basis: "none", sampleSize: 0,
      source: "UNKNOWN", confidence: "none",
      note: "audience demographics require a specialist provider (Modash/HypeAuditor); not available from public IG data",
    },
  };
}

/** Build the ScrapeCreators Instagram provider. `apiKey` is the funded SCRAPECREATORS_API_KEY. */
export function scrapeCreatorsIgProvider(apiKey: string): CreatorDataProvider {
  const capabilities = new Set<ProviderCapability>(["discover", "profile"]);
  // Captions of the relevant-hashtag posts each creator authored, keyed by canonicalKey. Gathered free during
  // discovery and fed to the scorers so content/brand fit reflect a creator's ACTUAL posts, not just their bio.
  const captions = new Map<string, string[]>();
  const addCaption = (id: string, caption: string | null) => {
    if (!caption) return;
    const k = `instagram:${id}`;
    const arr = captions.get(k) ?? [];
    if (arr.length < 5) arr.push(caption.slice(0, 300));
    captions.set(k, arr);
  };
  return {
    name: "scrapecreators-instagram",
    capabilities,
    postContext: () => captions,

    async discover(spec: CreatorSearchSpec, limit: number): Promise<CreatorIdentity[]> {
      const floor = spec.minFollowers ?? DEFAULT_DISCOVER_FLOOR;
      const hashtags = [...new Set(spec.keywords.map(compact).filter((h) => h.length >= 4))].slice(0, 6);

      // Primary discovery = HASHTAG search: the AUTHORS of posts under the brand's hashtags are real creators
      // making relevant content, NOT shops that merely put the category in their name. Each owner carries a
      // follower_count, so we drop tiny shops/resellers up front (the floor) without spending a profile credit.
      // Rank candidates by how many relevant posts they authored (topical dedication), then reach.
      const owners = new Map<string, { identity: CreatorIdentity; followers: number; hits: number }>();
      // Fetch all hashtags for a media type IN PARALLEL (one round of latency, not one per hashtag) so the
      // whole run stays well under the serverless function time limit, then fold the posts into the owner map.
      const collect = async (mediaType: "reels" | "all") => {
        const bodies = await Promise.all(
          hashtags.map(async (h) => {
            try {
              return await getJson(`${BASE}/search/hashtag?hashtag=${encodeURIComponent(h)}&media_type=${mediaType}`, apiKey);
            } catch (e) {
              if (isFatal(e)) throw e; // out of credits / bad key -> surface honestly
              return null; // a dead or empty hashtag is fine
            }
          }),
        );
        for (const body of bodies) {
          const posts = body && Array.isArray(body.posts) ? (body.posts as Record<string, unknown>[]) : [];
          for (const p of posts) {
            const o = (p.owner ?? {}) as Record<string, unknown>;
            const id = str(o.id);
            const handle = str(o.username);
            if (!id || !handle) continue;
            const foll = num(o.follower_count);
            if (foll != null && foll < floor) continue; // skip tiny shops/resellers
            addCaption(id, str(p.caption)); // capture what they actually posted under this brand hashtag
            const prev = owners.get(id);
            if (prev) prev.hits += 1;
            else owners.set(id, { identity: { platform: "instagram", platformUserId: id, handle, profileUrl: igUrl(handle) }, followers: foll ?? 0, hits: 1 });
          }
        }
      };
      await collect("reels"); // reels bias toward creators (shops post catalog statics)
      if (owners.size < limit) await collect("all"); // widen if reels was thin

      // Fallback: only if hashtag discovery found nobody, fall back to keyword search (name-match). Lower
      // quality (surfaces shops), so it is a last resort, and we cannot floor-filter it (no follower data).
      if (owners.size === 0) {
        const seen = new Map<string, CreatorIdentity>();
        for (const q of spec.keywords) {
          if (seen.size >= limit) break;
          const term = q.trim();
          if (!term) continue;
          let body: Record<string, unknown>;
          try {
            body = await getJson(`${BASE}/search?query=${encodeURIComponent(term)}`, apiKey);
          } catch (e) {
            if (isFatal(e)) throw e;
            continue;
          }
          const users = (Array.isArray(body.users) ? body.users : Array.isArray((body.data as Record<string, unknown>)?.users) ? (body.data as Record<string, unknown>).users : []) as Record<string, unknown>[];
          for (const usr of users) {
            const id = str(usr.id) ?? str(usr.pk);
            const handle = str(usr.username);
            if (!id || !handle || seen.has(id)) continue;
            seen.set(id, { platform: "instagram", platformUserId: id, handle, profileUrl: igUrl(handle) });
            if (seen.size >= limit) break;
          }
        }
        return [...seen.values()];
      }

      return [...owners.values()]
        .sort((a, b) => b.hits - a.hits || b.followers - a.followers)
        .slice(0, limit)
        .map((x) => x.identity);
    },

    async profile(identity: CreatorIdentity): Promise<NormalizedCreator> {
      const body = await getJson(`${BASE}/profile?handle=${encodeURIComponent(identity.handle)}`, apiKey);
      return mapProfile(identity, body);
    },

    // Public engager demographics are not reliably available here. Honest: no capability, empty sample - the
    // audience estimate therefore stays UNKNOWN rather than being invented from a thin, biased read.
    async engagers(_identity: CreatorIdentity, _sample: number): Promise<EngagerSignal[]> {
      return [];
    },
  };
}
