// Provider abstraction (ADR-0002): Meta and Google implement one interface so the
// cockpit and sync stay source-agnostic and Google can land late without UI changes.

export type Platform = "meta" | "google";

export type TokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
};

/** One competitor/own ad as returned by a source (pre-normalization). */
export type SourceAd = {
  externalId: string;
  name?: string;
  creativeUrl?: string;
  mediaType: "image" | "video" | "unknown";
  copy?: string;
  status?: string;
};

/** One day of performance for one ad. */
export type MetricsRow = {
  adExternalId: string;
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  frequency: number;
};

export interface AdSource {
  readonly platform: Platform;
  /** List the ads under a connected account. */
  listAds(accountExternalId: string, token: TokenSet): Promise<SourceAd[]>;
  /** Fetch daily metrics for an ad since a date (incremental sync). */
  fetchMetrics(adExternalId: string, since: string, token: TokenSet): Promise<MetricsRow[]>;
  /** Exchange a refresh token for a fresh access token. */
  refreshToken(refreshToken: string): Promise<TokenSet>;
}
