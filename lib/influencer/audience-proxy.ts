// Path A: cheap, HONEST audience estimation. We cannot see a creator's true follower demographics (those
// are private, visible only to the creator in their own analytics - see docs/plans/influencer-hunt.md).
// So instead of guessing or paying a specialist, we model a DIRECTIONAL estimate from public signals we
// can cheaply see: the creator's own location/language, plus a sample of the people who publicly COMMENT
// on their posts. This is an INFERENCE, never a fact - confidence is capped at "medium" forever, because
// commenters are a biased proxy for followers and the sample is small. The output is always labeled so the
// UI and scores treat it as a hint, and it degrades to UNKNOWN-equivalent (empty) when there is no signal.
//
// Pure, no I/O. The adapter (Phase 2) fetches the engager sample; this file only reasons about it.

import type { AudienceEstimate, EngagerSignal, Confidence } from "./types";

const MIN_FOR_LOW = 8; // fewer engager signals than this -> the sample is too thin to lean on at all
const MIN_FOR_MEDIUM = 40; // at/above this the read is "medium"; we NEVER report "high" from a proxy
const MIN_GENDER_SIGNALS = 12; // need at least this many confident name->gender guesses to lean on gender

function shareMap<T extends string>(items: (T | null)[]): { key: T; share: number }[] {
  const counts = new Map<T, number>();
  let total = 0;
  for (const it of items) {
    if (!it) continue;
    counts.set(it, (counts.get(it) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return [];
  return [...counts.entries()]
    .map(([key, n]) => ({ key, share: n / total }))
    .sort((a, b) => b.share - a.share);
}

/**
 * Estimate a creator's audience from public signals. `engagers` is a sample of people who commented on
 * recent posts (each carries whatever we could read from THEIR public profile). Returns a directional,
 * honestly-labeled estimate. When there is no engager signal it falls back to the creator's own country as
 * a weak proxy (basis "creator-only", low confidence), or "none" when we know nothing at all.
 */
export function estimateAudience(
  creatorCountry: string | null,
  creatorLanguage: string | null,
  engagers: EngagerSignal[],
): AudienceEstimate {
  const usable = engagers.filter((e) => e.countryCode || e.language || e.genderGuess);
  const sampleSize = usable.length;

  // No engager signal at all -> fall back to the creator's own country/language as a weak proxy.
  if (sampleSize === 0) {
    if (!creatorCountry && !creatorLanguage) {
      return {
        topCountries: [],
        genderLean: null,
        topLanguages: [],
        basis: "none",
        sampleSize: 0,
        source: "UNKNOWN",
        confidence: "none",
        note: "No audience signal available - audience demographics are private and no public proxy was found.",
      };
    }
    return {
      topCountries: creatorCountry ? [{ countryCode: creatorCountry, share: 1 }] : [],
      genderLean: null,
      topLanguages: creatorLanguage ? [{ language: creatorLanguage, share: 1 }] : [],
      basis: "creator-only",
      sampleSize: 0,
      source: "INFERENCE",
      confidence: "low",
      note: "Directional only: based on the creator's own location/language, not on follower data.",
    };
  }

  const topCountries = shareMap(usable.map((e) => e.countryCode)).map((x) => ({ countryCode: x.key, share: round(x.share) }));
  const topLanguages = shareMap(usable.map((e) => e.language)).map((x) => ({ language: x.key, share: round(x.share) }));

  // Gender lean only when enough confident name->gender guesses exist; else null (never a 50/50 guess).
  const genderGuesses = usable.map((e) => e.genderGuess).filter((g): g is "f" | "m" => g === "f" || g === "m");
  let genderLean: AudienceEstimate["genderLean"] = null;
  if (genderGuesses.length >= MIN_GENDER_SIGNALS) {
    const female = genderGuesses.filter((g) => g === "f").length / genderGuesses.length;
    genderLean = { female: round(female), male: round(1 - female) };
  }

  // Confidence: capped at "medium" always (a commenter sample is a biased, partial proxy for followers).
  const confidence: Confidence = sampleSize >= MIN_FOR_MEDIUM ? "medium" : sampleSize >= MIN_FOR_LOW ? "low" : "low";

  return {
    topCountries,
    genderLean,
    topLanguages,
    basis: "commenter-sample",
    sampleSize,
    source: "INFERENCE",
    confidence,
    note: `Estimated from ${sampleSize} sampled commenters - directional, not verified follower data.`,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
