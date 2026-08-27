import { adsManagerUrl } from "@/lib/app/ads-manager-url";

// An ad's name, linked to that exact ad in the account's Meta Ads Manager (new tab) so
// the AI's call can be checked against the live ad. Falls back to plain text when the ad
// account id is unknown (e.g. a stale cache entry). Server-safe: a plain anchor, no JS.
export function AdLink({
  accountId,
  adId,
  name,
  className,
}: {
  accountId?: string;
  adId: string;
  name: string;
  className?: string;
}) {
  const href = adsManagerUrl(accountId, adId);
  if (!href) return <span className={className}>{name}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Open this ad in Meta Ads Manager to verify"
      className={`${className ?? ""} underline decoration-[var(--hairline)] decoration-1 underline-offset-2 transition hover:text-[var(--accent)] hover:decoration-[var(--accent)]`}
    >
      {name}
    </a>
  );
}
