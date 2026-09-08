// Cookie-consent state shared by the banner (components/cookie-consent) and GA (components/google-analytics).
// The public site is cookie-free by default; the ONLY thing that sets cookies is GA4, so consent gates GA and
// nothing else. Choice is stored per-browser in localStorage. The pure normalizer is unit-tested (check:consent);
// the get/set touch localStorage and are guarded for SSR.

export const CONSENT_KEY = "adscale.cookie-consent";
export const CONSENT_EVENT = "adscale-consent"; // dispatched on window when the choice changes
export type Consent = "granted" | "denied";

// PURE: coerce a stored string to a valid choice, or null when absent/garbage. Testable with no DOM.
export function normalizeConsent(raw: string | null | undefined): Consent | null {
  return raw === "granted" || raw === "denied" ? raw : null;
}

export function getConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeConsent(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    return null; // private mode / storage blocked -> treat as undecided
  }
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === "granted";
}

export function setConsent(v: Consent): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* storage blocked: the choice just won't persist across visits, which is safe (banner reappears) */
  }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}
