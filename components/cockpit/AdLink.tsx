import { adsManagerUrl } from "@/lib/app/ads-manager-url";

// An ad's name, linked to that exact ad in the account's Meta Ads Manager (new tab), opened
// with its campaign -> ad set -> ad selected so the AI's call can be traced to the exact
// campaign/ad set it came from. Falls back to plain text when the ad account id is unknown
// (e.g. a stale cache entry). Server-safe: a plain anchor, no JS.
export function AdLink({
  accountId,
  adId,
  adSetId,
  campaignId,
  name,
  className,
  dateParam,
}: {
  accountId?: string;
  adId: string;
  adSetId?: string;
  campaignId?: string;
  name: string;
  className?: string;
  dateParam?: string;
}) {
  const href = adsManagerUrl(accountId, adId, { adSetId, campaignId, dateParam });
  if (!href) return <span className={className}>{name}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open this ad in Meta Ads Manager (campaign - ad set - ad selected) to verify"
      className={`${className ?? ""} rounded-sm underline decoration-[var(--hairline)] decoration-1 underline-offset-2 transition hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1`}
    >
      {name}
    </a>
  );
}
