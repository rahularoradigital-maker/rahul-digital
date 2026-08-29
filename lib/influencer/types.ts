// Influencer Hunt — core types. Isolated module (feature-flagged). Everything here is pure + provider-
// agnostic. The non-negotiable rule (APP-CANON R1): NEVER fabricate. Every fact carries an Evidence
// envelope naming where it came from and how sure we are, so a modeled/inferred value can never be shown
// as ground truth. A value we don't have is `null` with source UNKNOWN, never a fake 0.

/** Where a fact came from, strongest → weakest. Drives how it's shown + how much a score may trust it. */
export type EvidenceSource =
  | "VERIFIED" // first-party truth (e.g. Meta on an account the user manages)
  | "PROVIDER" // a data provider returned it (Modash/ScrapeCreators/etc.) - real but second-hand
  | "PUBLIC_WEB" // read from a public page/profile
  | "CALCULATED" // we computed it from other real numbers (e.g. engagement rate from real likes)
  | "MODEL" // a specialist provider's statistical model (audience demographics from sampling)
  | "INFERENCE" // OUR cheap proxy/inference (Path A) - honest guess, always low/medium confidence
  | "UNKNOWN"; // we do not have it. Never guess.

/** Confidence band for any field or score. UNKNOWN facts are always "none". */
export type Confidence = "high" | "medium" | "low" | "none";

/** A single fact + its provenance. The `value` is null exactly when source is UNKNOWN. */
export type Evidence<T> = {
  value: T | null;
  source: EvidenceSource;
  confidence: Confidence;
  collectedAt: string | null; // ISO; null when UNKNOWN
  note?: string; // short human reason, e.g. "from 42 sampled commenters"
};

/** Build an UNKNOWN evidence (the honest default - never a fabricated 0). */
export function unknown<T>(note?: string): Evidence<T> {
  return { value: null, source: "UNKNOWN", confidence: "none", collectedAt: null, note };
}

/** Build a known evidence. Guards the invariant: a non-UNKNOWN source must carry a real (non-null) value. */
export function evidence<T>(value: T, source: Exclude<EvidenceSource, "UNKNOWN">, confidence: Confidence, collectedAt: string, note?: string): Evidence<T> {
  return { value, source, confidence, collectedAt, note };
}

export type Platform = "instagram" | "youtube" | "tiktok" | "x";

/** Canonical identity across providers: platform + the platform's stable user id (never the handle alone,
 * which can change). Used to dedupe the same creator seen through two providers. */
export type CreatorIdentity = { platform: Platform; platformUserId: string; handle: string; profileUrl: string };

/** A person who engaged (commented on) a creator's post - the raw signal Path A models an audience from.
 * All fields are best-effort from that engager's PUBLIC profile; absent = null (never inferred here). */
export type EngagerSignal = {
  countryCode: string | null; // ISO-2, from the engager's public location if present
  language: string | null; // BCP-47-ish, from the engager's content/bio language if detectable
  genderGuess: "f" | "m" | null; // ONLY when a name→gender lookup is confident; else null (never a coin-flip)
};

/** Path A output: a cheap, HONEST audience estimate. Never precise demographics - a directional read with
 * explicit confidence + basis, so the UI/score can weight it lightly and label it as an inference. */
export type AudienceEstimate = {
  topCountries: { countryCode: string; share: number }[]; // share 0..1, descending; [] when no signal
  genderLean: { female: number; male: number } | null; // shares 0..1; null when too little name signal
  topLanguages: { language: string; share: number }[];
  basis: "commenter-sample" | "creator-only" | "none"; // what the estimate is actually built from
  sampleSize: number; // how many engager signals fed it (0 = creator-only or none)
  source: Extract<EvidenceSource, "INFERENCE" | "UNKNOWN">;
  confidence: Confidence;
  note: string; // e.g. "estimated from 63 sampled commenters - directional, not verified follower data"
};

/** The normalized creator every provider adapter maps into. Metrics are Evidence-wrapped so provenance +
 * confidence travel with the number everywhere. Audience is the Path A estimate (or an UNKNOWN-equivalent). */
export type NormalizedCreator = {
  identity: CreatorIdentity;
  name: Evidence<string>;
  bio: Evidence<string>;
  followers: Evidence<number>;
  following: Evidence<number>;
  postsCount: Evidence<number>;
  verified: Evidence<boolean>;
  accountType: Evidence<"business" | "creator" | "personal">;
  creatorCountry: Evidence<string>; // ISO-2, the creator's OWN location (a weak audience proxy)
  creatorLanguage: Evidence<string>;
  avgLikes: Evidence<number>;
  avgComments: Evidence<number>;
  avgViews: Evidence<number>;
  engagementRate: Evidence<number>; // CALCULATED from real recent posts when possible
  engagementMethod: string; // documented denominator, e.g. "(likes+comments)/followers over last 12 posts"
  businessEmail: Evidence<string>; // ONLY a self-published public business email; else UNKNOWN
  audience: AudienceEstimate; // Path A
};

/** Configurable follower tiers (never one universal band - varies by platform/geo/campaign/brand). */
export type Tier = "nano" | "micro" | "mid" | "macro" | "mega";
export type TierBands = { nano: number; micro: number; mid: number; macro: number }; // upper bound of each; >macro = mega

/** The parsed, user-confirmed search spec. Shown before any search runs; never silently altered. */
export type CreatorSearchSpec = {
  platform: Platform;
  keywords: string[];
  minFollowers: number | null;
  maxFollowers: number | null;
  minEngagementRate: number | null; // fraction, e.g. 0.03
  creatorCountry: string | null; // ISO-2
  creatorGender: "f" | "m" | null;
  audienceCountry: string | null; // ISO-2 - matched against the Path A estimate (weighted by its confidence)
  languages: string[];
  tier: Tier | null;
};

/** The brand-side inputs the scoring engines compare a creator against. Derived from the confirmed
 * BrandProfile + tracked competitors + the creative-gap intelligence + the search spec. Everything a score
 * needs about "who the brand is and what it needs" lives here, so the scorers stay pure + testable. */
export type BrandTarget = {
  category: string | null;
  keyProducts: string[];
  targetCountry: string | null; // ISO-2 the brand sells to
  languages: string[];
  personaGender: "f" | "m" | null; // the customer persona's gender, when the brand has one
  tone: string | null; // brand voice, e.g. "festive, elegant"
  requiredFormats: ("video" | "static" | "carousel" | "ugc")[]; // creative the brand needs (from creative gaps)
  contentKeywords: string[]; // topics/angles the brand needs the creator to cover
  competitors: string[]; // competitor brand names/handles, for the overlap read
};

/** One component of a transparent score: its own sub-score, weight, and the evidence line behind it. */
export type ScoreComponent = { key: string; score: number; weight: number; reason: string; confidence: Confidence };

/** Every score in the app decomposes to this - no unexplained rankings (APP-CANON: formula-driven). */
export type TransparentScore = {
  score: number; // 0..100
  components: ScoreComponent[];
  formula: string; // e.g. "sum(weight * component)"
  reason: string; // one-line human summary
  confidence: Confidence; // capped by the weakest load-bearing input's confidence
};
