// Deep link into the account's Meta Ads Manager, opened at ONE specific ad with its full
// hierarchy selected - campaign -> ad set -> ad - so any AI suggestion can be traced to
// exactly which campaign we tested and which ad set the fatigue is coming from, over the
// same date window the user is looking at in AdBrain.
//
// Ids are bare numbers (external_id has no "act_" prefix; ad/adset/campaign ids are the Meta
// ids). We select all three levels so Ads Manager opens with the ad highlighted AND its ad
// set + campaign selected in the breadcrumb, then filter_set narrows the Ads tab to the ad.
// dateParam ("YYYY-MM-DD_YYYY-MM-DD") carries the window. Returns null when the account or ad
// id is missing, so callers render plain text instead of a broken link.
export type AdHierarchy = { adSetId?: string; campaignId?: string; dateParam?: string };

export function adsManagerUrl(accountId: string | undefined, adId: string | undefined, opts: AdHierarchy = {}): string | null {
  if (!accountId || !adId) return null;
  const { adSetId, campaignId, dateParam } = opts;
  // Raw JSON here: URLSearchParams encodes it exactly once (pre-encoding would double-encode
  // the % signs and break the filter).
  const filter = JSON.stringify([{ field: "ad.id", operator: "IN", value: [adId] }]);
  const params = new URLSearchParams();
  params.set("act", accountId);
  params.set("filter_set", filter);
  // Selecting the parents (when known) is what opens the ad in context: campaign -> ad set -> ad.
  if (campaignId) params.set("selected_campaign_ids", campaignId);
  if (adSetId) params.set("selected_adset_ids", adSetId);
  params.set("selected_ad_ids", adId);
  if (dateParam) params.set("date", dateParam);
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?${params.toString()}`;
}
