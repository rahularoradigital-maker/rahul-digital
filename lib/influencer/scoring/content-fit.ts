// Content-Fit: does the creator make the KIND of content the brand needs? The rich version reads recent
// posts (a later phase). Until then this is a PROVISIONAL proxy from the creator's public words vs the
// brand's needed angles/formats, carried at LOW confidence and clearly labeled, never inflated. Pure.

import type { NormalizedCreator, BrandTarget, TransparentScore, ScoreComponent, Confidence } from "../types.ts";
import { tokens, overlapScore, compose } from "./util.ts";

export function contentFit(creator: NormalizedCreator, target: BrandTarget, recentPostText?: string[]): TransparentScore {
  const brandWords = tokens(...target.contentKeywords, ...target.requiredFormats, target.category);
  const haveContent = Array.isArray(recentPostText) && recentPostText.length > 0;
  const creatorWords = haveContent ? tokens(...(recentPostText as string[])) : tokens(creator.bio.value, creator.name.value);
  const conf: Confidence = haveContent ? "medium" : creator.bio.value ? "low" : "none";
  const components: ScoreComponent[] = [
    { key: "topic_relevance", score: overlapScore(brandWords, creatorWords), weight: 1, confidence: conf, reason: haveContent ? "recent posts overlap the brand's needed topics/formats" : "provisional: from bio only until recent posts are analyzed" },
  ];
  return compose(components, haveContent ? "Content fit from recent posts." : "Provisional content fit (bio only) - upgrades when recent posts are pulled.");
}
