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
const TIMEOUT_MS = 15_000;
const RECENT_POSTS_FOR_ER = 12; // engagement rate is averaged over up to this many recent posts

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
    identity: { ...identity, handle: username, profileUrl: `https://instagram.com/${username}` },
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
  return {
    name: "scrapecreators-instagram",
    capabilities,

    async discover(spec: CreatorSearchSpec, limit: number): Promise<CreatorIdentity[]> {
      const seen = new Map<string, CreatorIdentity>();
      // One search per keyword phrase; stop once we have enough unique candidates to keep credit cost bounded.
      for (const q of spec.keywords) {
        if (seen.size >= limit) break;
        const term = q.trim();
        if (!term) continue;
        const body = await getJson(`${BASE}/search?query=${encodeURIComponent(term)}`, apiKey);
        const users =
          (Array.isArray(body.users) ? body.users : Array.isArray((body.data as Record<string, unknown>)?.users) ? (body.data as Record<string, unknown>).users : []) as Record<string, unknown>[];
        for (const usr of users) {
          const id = str(usr.id) ?? str((usr as Record<string, unknown>).pk);
          const handle = str(usr.username);
          if (!id || !handle || seen.has(id)) continue;
          seen.set(id, { platform: "instagram", platformUserId: id, handle, profileUrl: `https://instagram.com/${handle}` });
          if (seen.size >= limit) break;
        }
      }
      return [...seen.values()];
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
