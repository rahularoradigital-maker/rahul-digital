// Source registry: pick the AdSource implementation for a platform, so sync/ingest and any future
// platform-aware reader stay vendor-agnostic (ADR-0002). Meta and Google are separate sources for now.
import type { AdSource, Platform } from "./ad-source.ts";
import { metaSource } from "./meta-source.ts";
import { googleAdsSource } from "./google-source.ts";

export function getAdSource(platform: Platform): AdSource {
  return platform === "google" ? googleAdsSource : metaSource;
}
