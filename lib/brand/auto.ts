import "server-only";
import { fetchLiveCockpit } from "@/lib/meta-sync";
import { fetchAccountCurrency, fetchBrandWebsite } from "@/lib/meta-source";
import type { TokenSet } from "@/lib/ad-source";
import { deriveBrandProfile, loadBrandProfile, saveBrandProfile } from "./profile";

// Auto-learn a brand the FIRST time its account is selected (the vision: "as soon as I pick a
// different account it understands the brand"). Runs in the background on account switch and derives
// a DRAFT profile from the account's real ads, so Market > Brand already has something waiting to
// review - the "auto, with a review step" model. Grounded (deriveBrandProfile is told never to invent).
//
// Two invariants keep this safe to fire on every switch:
//  - IDEMPOTENT: if any profile already exists for (user, account) it does nothing, so a user's edits
//    or confirmed profile are never overwritten by a background re-learn.
//  - PROVIDER-TOLERANT: it never throws and returns a status; if Gemini/the account is unavailable it
//    simply saves nothing and the user can still learn on demand from the Brand tab.

export type AutoDeriveResult = "exists" | "no-key" | "no-ads" | "derive-failed" | "saved";

export async function autoDeriveBrandDraft(
  userId: string,
  accountExternalId: string,
  accountName: string | null,
  token: TokenSet,
): Promise<AutoDeriveResult> {
  if (!process.env.GEMINI_API_KEY) return "no-key";
  // Never clobber an existing draft/confirmed profile - the review step owns it once it exists.
  if (await loadBrandProfile(userId, accountExternalId)) return "exists";

  // The switch route warms the 14-day cockpit just before this runs, so this read hits that warm
  // cache; ad NAMES alone carry the category/product signal Gemini needs. Currency is a cheap side call.
  const [currency, live, website] = await Promise.all([
    fetchAccountCurrency(accountExternalId, token).catch(() => null),
    fetchLiveCockpit(userId, 14).catch(() => null),
    fetchBrandWebsite(accountExternalId, token).catch(() => null), // real landing-host website, never guessed
  ]);
  const adNames =
    live && live.status === "connected"
      ? live.view.leaderboard.map((a) => a.name).filter((n): n is string => Boolean(n))
      : [];
  if (adNames.length === 0) return "no-ads";

  const derived = await deriveBrandProfile(accountName ?? "", currency, adNames, []);
  if (!derived) return "derive-failed"; // e.g. the model is rate-limited - stay silent, learn on demand later
  if (website) derived.website = website; // real landing-host domain wins over the model's guess
  await saveBrandProfile(userId, accountExternalId, accountName, currency, derived, "draft");
  return "saved";
}
