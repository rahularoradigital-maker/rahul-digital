// The ads a resumable ingestion run should sync, in priority order: never-synced first (syncedAt defaults
// to 0), then stalest, and any ad synced on/after `cutoff` skipped. Pure (no server-only imports) so it can
// be unit-tested directly - getting this ordering wrong is what would make the sync thrash or never converge.
export function selectAdsToSync<T extends { adId: string }>(allAds: T[], syncedAt: Map<string, number>, cutoff: number): T[] {
  return allAds.filter((a) => (syncedAt.get(a.adId) ?? 0) < cutoff).sort((a, b) => (syncedAt.get(a.adId) ?? 0) - (syncedAt.get(b.adId) ?? 0));
}
