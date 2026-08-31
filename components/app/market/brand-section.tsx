import { getCurrentUser } from "@/lib/app/user";
import { getUserMetaSession } from "@/lib/meta-sync";
import { loadBrandProfile } from "@/lib/brand/profile";
import { BrandProfilePanel, type EditableProfile } from "./brand-profile-panel";
import { CompetitorDiscovery } from "./competitor-discovery";

// Brand understanding (Stage 1 of auto brand context). Loads the stored profile for the active
// account and hands it to the reviewable panel; null means "not learned yet" -> the panel shows a
// "Learn this brand" button.
export async function BrandSection() {
  const user = await getCurrentUser();
  const session = user ? await getUserMetaSession(user.id) : null;
  const profile = user && session ? await loadBrandProfile(user.id, session.activeExternalId) : null;

  if (!session) {
    return (
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6 text-sm text-[var(--ink-muted)]">
        Connect a Meta ad account first - brand understanding is derived from that account&apos;s live ads.
      </div>
    );
  }

  const initial: EditableProfile | null = profile
    ? {
        category: profile.category,
        subcategories: profile.subcategories,
        keyProducts: profile.keyProducts,
        pricePositioning: profile.pricePositioning,
        targetMarket: profile.targetMarket,
        brandVoice: profile.brandVoice,
        summary: profile.summary,
        website: profile.website,
        currency: profile.currency,
        status: profile.status,
      }
    : null;

  return (
    <div className="space-y-4">
      <BrandProfilePanel initial={initial} />
      {/* Discovery uses the CONFIRMED profile, so only surface it once the brand is confirmed. */}
      {profile?.status === "confirmed" && <CompetitorDiscovery />}
    </div>
  );
}
