// One runnable check for the Google Ads source adapter (stub/DEMO mode). No frameworks.
// Run: node --experimental-strip-types scripts/check-google-ads-source.ts
import assert from "node:assert/strict";
import { googleAdsSource, isGoogleAdsConfigured } from "../lib/google-source.ts";

// Implements the AdSource contract for the google platform.
assert.equal(googleAdsSource.platform, "google", "platform is google");

// No developer token in the test env -> DEMO mode (keyless, so the platform selector is testable today).
assert.equal(isGoogleAdsConfigured(), false, "no GOOGLE_ADS_DEVELOPER_TOKEN -> demo mode");

const token = { accessToken: "x" };

// listAds returns a stable, non-empty demo set.
const ads1 = await googleAdsSource.listAds("acct1", token);
const ads2 = await googleAdsSource.listAds("acct1", token);
assert.ok(ads1.length > 0, "demo ads present");
assert.deepEqual(ads1, ads2, "listAds is deterministic");
for (const a of ads1) {
  assert.ok(a.externalId.startsWith("g_acct1_"), `ad id namespaced to account: ${a.externalId}`);
  assert.equal(a.status, "ACTIVE");
}

// fetchMetrics returns deterministic daily rows with real, positive numbers in the vendor-independent shape.
const m1 = await googleAdsSource.fetchMetrics("g_acct1_1", "2026-08-01", token);
const m2 = await googleAdsSource.fetchMetrics("g_acct1_1", "2026-08-01", token);
assert.ok(m1.length > 0, "demo metrics present");
assert.deepEqual(m1, m2, "fetchMetrics is deterministic");
for (const r of m1) {
  assert.ok(r.spend >= 0 && r.impressions > 0 && r.clicks >= 0, `sane row on ${r.date}`);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.date), "iso date");
}
// Different account/ad -> different data (namespaced, not a constant).
const other = await googleAdsSource.fetchMetrics("g_acct1_2", "2026-08-01", token);
assert.notDeepEqual(other, m1, "different ad -> different demo series");

console.log(`OK check-google-ads-source: demo mode, ${ads1.length} ads, deterministic metrics, AdSource contract met.`);
