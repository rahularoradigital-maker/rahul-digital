// Audience-Fit: does the creator's audience match the brand's target customer? Compares the Path A audience
// estimate (country / language / gender lean) against the BrandTarget. Honesty rule: this score can only be
// as confident as the audience estimate it rests on - a thin proxy makes the fit LOW confidence, never a
// confident number. Pure.

import type { NormalizedCreator, BrandTarget, TransparentScore, ScoreComponent, Confidence } from "../types.ts";
import { compose } from "./util.ts";

export function audienceFit(creator: NormalizedCreator, target: BrandTarget): TransparentScore {
  const a = creator.audience;
  const baseConf: Confidence = a.confidence;
  const components: ScoreComponent[] = [];

  if (target.targetCountry && a.topCountries.length > 0) {
    const hit = a.topCountries.find((c) => c.countryCode === target.targetCountry);
    const share = hit ? hit.share : 0;
    components.push({ key: "audience_country", score: Math.round(share * 100), weight: 0.5, confidence: baseConf, reason: hit ? `~${Math.round(share * 100)}% of the sampled audience is in ${target.targetCountry}` : `${target.targetCountry} not seen in the audience sample` });
  } else {
    components.push({ key: "audience_country", score: 0, weight: 0.5, confidence: "none", reason: "No audience-country signal to compare." });
  }

  if (target.languages.length > 0 && a.topLanguages.length > 0) {
    const langs = new Set(a.topLanguages.map((l) => l.language.toLowerCase()));
    const match = target.languages.some((l) => langs.has(l.toLowerCase()));
    const topShare = a.topLanguages[0]?.share ?? 0;
    components.push({ key: "audience_language", score: match ? Math.round(topShare * 100) : 0, weight: 0.3, confidence: baseConf, reason: match ? `audience speaks a target language (top share ~${Math.round(topShare * 100)}%)` : "audience language does not match the target" });
  } else {
    components.push({ key: "audience_language", score: 0, weight: 0.3, confidence: "none", reason: "No audience-language signal to compare." });
  }

  if (target.personaGender && a.genderLean) {
    const leanToPersona = target.personaGender === "f" ? a.genderLean.female : a.genderLean.male;
    components.push({ key: "audience_gender", score: Math.round(leanToPersona * 100), weight: 0.2, confidence: baseConf, reason: `~${Math.round(leanToPersona * 100)}% of the estimated audience matches the ${target.personaGender === "f" ? "female" : "male"} persona` });
  } else {
    components.push({ key: "audience_gender", score: 0, weight: 0.2, confidence: "none", reason: "No usable gender signal / no persona gender set." });
  }

  return compose(components, a.basis === "none" ? "Audience unknown - no public signal to estimate fit." : `Audience fit from the ${a.basis} estimate (${a.note}).`);
}
