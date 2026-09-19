import type { Metadata } from "next";
import IntegrationThemed from "@/components/marketing/integration-themed";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";
const TITLE = "Google Ads integration for AdScale";
const DESCRIPTION =
  "AdScale reads Google Ads the way a media buyer thinks: budget-capped vs rank-capped, Quality Score drag, and value-bidding readiness, per campaign type. Read-only, and rolling out now.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/integrations/google-ads" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/integrations/google-ads`, siteName: "AdScale AI" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function GoogleAdsIntegrationPage() {
  return (
    <IntegrationThemed
      active="/integrations/google-ads"
      eyebrow="Google Ads integration · rolling out"
      h1="Google Ads, read the way a buyer thinks."
      lede="Not a Meta view forced onto Google. AdScale reads the Google levers, budget vs rank, Quality Score, value bidding, and tells you what to change, with a reason. Meta is live today; Google is rolling out now."
      connects={[
        { k: "Your Google Ads account, read-only", v: "Connect through Google's own login and grant read access. AdScale reads performance, it never spends or changes anything." },
        { k: "Every campaign type", v: "Search, Performance Max, Shopping, Demand Gen and Video, each judged on the metric that actually matters for it." },
        { k: "The auction signals Meta does not have", v: "Impression share, lost impression share, and Quality Score, the levers that decide whether Google shows your ad at all." },
      ]}
      decisions={[
        { h: "Budget-capped or rank-capped, answered", d: "Impression share split into lost-to-budget vs lost-to-rank, so you raise budget on a winner or fix Ad Rank, never the wrong lever." },
        { h: "Quality Score, where it costs you", d: "Low Quality Score on real spend is flagged with the weakest component to fix, ranked by the money a fix would save." },
        { h: "Ready for value bidding", d: "When a campaign has enough conversions and distinct values, AdScale flags that it is ready to move to Target ROAS, not before." },
        { h: "The metric that matters, per type", d: "Search leads on cost per conversion and impression share, Shopping and PMax on ROAS, Video on view rate. The right north-star for each campaign type." },
        { h: "Learning-phase safe", d: "AdScale will not tell you to change a bid or budget while Smart Bidding is still learning, because that change would reset it and cost you." },
        { h: "One brain across Meta and Google", d: "The same money-at-stake ranking and reason-for-every-call rigor, now reading Google's own levers instead of forcing a Meta-shaped view onto it." },
      ]}
      dataLabel="The signals it reads."
      dataPoints={["Cost", "Impressions", "Clicks", "Conversions", "Conversion value", "ROAS", "CPA", "Search impression share", "Lost IS (budget)", "Lost IS (rank)", "Quality Score", "Campaign type"]}
      safe={[
        { k: "Read access only", v: "AdScale requests read scope for campaigns and metrics. It cannot spend, pause, or change your account." },
        { k: "Tokens encrypted", v: "Your access token is encrypted at rest and never returned to the browser." },
        { k: "Drafts, never auto-changes", v: "Every recommendation is a draft you action yourself in Google Ads." },
        { k: "Disconnect anytime", v: "Revoke access from AdScale or from Google, and the stored token is dropped." },
      ]}
      ctaH="Be first on Google Ads."
      ctaP="Meta is live today and Google is rolling out. Book a demo for early access."
    />
  );
}
