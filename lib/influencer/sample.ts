// SAMPLE creators for the Influencer Hunt preview. This is NOT real creator data - it exists only so the
// screen is fully live and shows the REAL ranking/scoring engine at work (transparent scores, evidence +
// confidence, "why this creator") before a data provider (ScrapeCreators/Modash) is connected. The UI
// labels this unmistakably as sample data. Handles are prefixed "sample_" so nobody mistakes them for a
// real account. When a provider is wired, the exact same engine runs on real NormalizedCreators instead.

import { unknown, evidence, type NormalizedCreator, type BrandTarget, type AudienceEstimate } from "./types.ts";

const AT = "2026-08-20"; // fixed sample collection date

function aud(over: Partial<AudienceEstimate>): AudienceEstimate {
  return { topCountries: [], genderLean: null, topLanguages: [], basis: "none", sampleSize: 0, source: "UNKNOWN", confidence: "none", note: "", ...over };
}

function sample(
  id: string,
  handle: string,
  name: string,
  followers: number,
  er: number,
  bio: string,
  country: string,
  audience: AudienceEstimate,
  opts: { email?: string | null; verified?: boolean } = {},
): NormalizedCreator {
  const avgLikes = Math.round(followers * er * 0.9);
  return {
    identity: { platform: "instagram", platformUserId: id, handle, profileUrl: `https://instagram.com/${handle}` },
    name: evidence(name, "PUBLIC_WEB", "high", AT),
    bio: evidence(bio, "PUBLIC_WEB", "medium", AT),
    followers: evidence(followers, "PROVIDER", "high", AT),
    following: evidence(Math.round(followers * 0.01), "PROVIDER", "high", AT),
    postsCount: evidence(420, "PROVIDER", "medium", AT),
    verified: evidence(opts.verified ?? false, "PROVIDER", "high", AT),
    accountType: evidence("creator", "PROVIDER", "medium", AT),
    creatorCountry: evidence(country, "PROVIDER", "medium", AT),
    creatorLanguage: evidence("hi", "PROVIDER", "low", AT),
    avgLikes: evidence(avgLikes, "CALCULATED", "medium", AT),
    avgComments: evidence(Math.round(avgLikes * 0.03), "CALCULATED", "medium", AT),
    avgViews: unknown("sample: view data not modeled"),
    engagementRate: evidence(er, "CALCULATED", "medium", AT, "(likes+comments)/followers over last 12 posts"),
    engagementMethod: "(likes+comments)/followers over last 12 posts",
    businessEmail: opts.email ? evidence(opts.email, "PUBLIC_WEB", "medium", AT, "public business email in bio") : unknown("no public business email found"),
    audience,
  };
}

/** A generic women's-ethnic-wear brand target for the preview (mirrors a Soch-like DTC brand). */
export const SAMPLE_TARGET: BrandTarget = {
  category: "women's ethnic wear",
  keyProducts: ["kurta sets", "sarees", "festive dresses"],
  targetCountry: "IN",
  languages: ["hi", "en"],
  personaGender: "f",
  tone: "festive, elegant, everyday-premium",
  requiredFormats: ["video", "ugc"],
  contentKeywords: ["festive", "styling", "kurta", "saree", "ootd", "ethnic"],
  competitors: ["fabindia", "biba", "w for woman"],
};

// A deliberately varied set so the ranking is visibly non-trivial: a relevant nano should outrank a huge
// off-category creator, and a creator with no audience read should score lower-confidence, not fake-high.
export const SAMPLE_CREATORS: NormalizedCreator[] = [
  sample("s1", "sample_ethnicdaily", "Aditi (Ethnic Daily)", 84_000, 0.052,
    "everyday ethnic styling · kurta & saree ootd · festive edits · hyderabad",
    "IN",
    aud({ topCountries: [{ countryCode: "IN", share: 0.82 }], topLanguages: [{ language: "hi", share: 0.61 }], genderLean: { female: 0.78, male: 0.22 }, basis: "commenter-sample", sampleSize: 64, source: "INFERENCE", confidence: "medium", note: "estimated from 64 sampled commenters - directional, not verified follower data" }),
    { email: "collabs@ethnicdaily.example", verified: true }),

  sample("s2", "sample_sareestories", "Meera (Saree Stories)", 21_000, 0.061,
    "saree draping · handloom love · festive styling reels · pune",
    "IN",
    aud({ topCountries: [{ countryCode: "IN", share: 0.9 }], topLanguages: [{ language: "hi", share: 0.55 }], genderLean: { female: 0.83, male: 0.17 }, basis: "commenter-sample", sampleSize: 41, source: "INFERENCE", confidence: "medium", note: "estimated from 41 sampled commenters - directional, not verified follower data" }),
    { email: "hello@sareestories.example" }),

  sample("s3", "sample_festivefits", "Ritika (Festive Fits)", 310_000, 0.028,
    "festive ethnic hauls · kurta sets · wedding guest looks · delhi",
    "IN",
    aud({ topCountries: [{ countryCode: "IN", share: 0.74 }], topLanguages: [{ language: "hi", share: 0.5 }], genderLean: { female: 0.71, male: 0.29 }, basis: "commenter-sample", sampleSize: 80, source: "INFERENCE", confidence: "medium", note: "estimated from 80 sampled commenters - directional, not verified follower data" }),
    { verified: true }),

  sample("s4", "sample_nanoethnic", "Sana (tiny ethnic corner)", 6_200, 0.084,
    "budget ethnic finds · kurta styling · thrift + festive · jaipur",
    "IN",
    aud({ topCountries: [{ countryCode: "IN", share: 0.88 }], topLanguages: [{ language: "hi", share: 0.66 }], genderLean: { female: 0.8, male: 0.2 }, basis: "commenter-sample", sampleSize: 33, source: "INFERENCE", confidence: "low", note: "estimated from 33 sampled commenters - thin sample, directional only" })),

  sample("s5", "sample_fitnessgirl", "Kavya (Fit & Fab)", 540_000, 0.041,
    "fitness · gym reels · protein recipes · home workouts · mumbai",
    "IN",
    aud({ topCountries: [{ countryCode: "IN", share: 0.7 }], genderLean: { female: 0.55, male: 0.45 }, topLanguages: [{ language: "hi", share: 0.48 }], basis: "commenter-sample", sampleSize: 72, source: "INFERENCE", confidence: "medium", note: "estimated from 72 sampled commenters - directional, not verified follower data" }),
    { verified: true }),

  sample("s6", "sample_usfashion", "Bella (US Fashion)", 1_200_000, 0.033,
    "western fashion · streetwear hauls · nyc ootd · zara & h&m finds",
    "US",
    aud({ topCountries: [{ countryCode: "US", share: 0.79 }], genderLean: { female: 0.68, male: 0.32 }, topLanguages: [{ language: "en", share: 0.9 }], basis: "commenter-sample", sampleSize: 90, source: "INFERENCE", confidence: "medium", note: "estimated from 90 sampled commenters - directional, not verified follower data" }),
    { verified: true }),

  sample("s7", "sample_noaudience", "Priya (styling)", 47_000, 0.038,
    "ethnic & fusion styling · kurta pairing tips · festive lookbook",
    "IN",
    aud({ basis: "none", source: "UNKNOWN", confidence: "none", note: "no audience signal collected for this sample creator" })),
];
