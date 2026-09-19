import type { Metadata } from "next";
import IntegrationThemed from "@/components/marketing/integration-themed";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";
const TITLE = "Meta Ads integration for AdScale";
const DESCRIPTION =
  "Connect your Meta ad account (read-only) and AdScale reads your day-wise performance and tells you what to scale, refresh, or kill, with a reason for every call. It never changes your account.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/integrations/meta" },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/integrations/meta`, siteName: "AdScale AI" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function MetaIntegrationPage() {
  return (
    <IntegrationThemed
      active="/integrations/meta"
      eyebrow="Meta Ads integration"
      h1="Your Meta account, read as a weekly decision."
      lede="Connect read-only. AdScale reads your day-wise performance and tells you what to scale, refresh, or kill, with a reason for every call."
      connects={[
        { k: "Your ad account, read-only", v: "You connect through Meta's own login and grant read access to ads and insights. AdScale can look, never touch." },
        { k: "Every account you can reach", v: "Accounts assigned directly to you and every account under your Business Managers, so an agency with hundreds of clients sees them all." },
        { k: "Day-wise performance", v: "Ads, ad sets and campaigns with their real daily numbers, the history the fatigue and trend reads are built on." },
      ]}
      decisions={[
        { h: "A verdict on every ad, with the reason", d: "Scale, refresh, or kill, each carrying a triple-labelled read: is it judgeable at all, do the signals agree, and how sure. Never a black-box call." },
        { h: "Objective, ROAS and trend on every action", d: "Each recommended action shows the campaign objective, the current ROAS, and whether the objective's own results are trending up or down." },
        { h: "Buyer-grade rigor before any call", d: "No fatigue or kill verdict on an ad that spent too little of its ad set to be judged. Statistical sufficiency and materiality come first." },
        { h: "Ranked by money at stake", d: "What to do today, ordered by the rupees on the line, and only on ads that are actually delivering, never a paused or dead entity." },
        { h: "Ad set and campaign at their own metrics", d: "Reach, frequency and budget read natively at each level, not naive roll-ups, so money figures trace to a real campaign and ad set." },
        { h: "Creative fatigue, caught early", d: "Day-wise frequency, engagement and cost read together against each ad's own baseline, so wear is flagged before cost per result doubles." },
      ]}
      dataLabel="The data it reads."
      dataPoints={["Spend", "Impressions", "Clicks", "Purchases", "Revenue", "Frequency", "Thumb-stop rate", "Hold rate", "Landing page views", "Add-to-cart", "Checkout", "Day-wise history"]}
      safe={[
        { k: "Read access only", v: "AdScale requests read scope for ads and insights. It cannot spend, pause, or change anything in your account." },
        { k: "Tokens encrypted", v: "Your access token is encrypted at rest and never sent back to the browser. Only account ids and names are ever returned." },
        { k: "Drafts, never auto-changes", v: "Every recommendation is a draft you action yourself in your ad account. AdScale does not push edits to Meta." },
        { k: "Disconnect anytime", v: "Revoke the connection from AdScale or from Meta, and the stored token is dropped." },
      ]}
      ctaH="Connect Meta and see your first plan."
      ctaP="AdScale is in private access. Book a demo and we will get you set up."
    />
  );
}
