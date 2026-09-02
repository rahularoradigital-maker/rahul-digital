// Platform-aware QA (Studio improvement #6). qa-engine.ts checks contrast / text-pixels / placeholder. This
// adds the platform-specific checks that actually get ads rejected or truncated: per-placement TEXT LIMITS,
// minimum MOBILE-legible font size, and story/reel SAFE-ZONE (text hidden behind the UI overlays). PURE +
// deterministic; advisory findings the Review step can show. No network, no model.

export type PlatformCheck = { name: string; pass: boolean; severity: "critical" | "warning"; detail: string };

// Documented visible-text limits (before Meta/Google truncate with an ellipsis). Conservative on purpose.
const LIMITS: Record<string, { headline: number; primary: number }> = {
  meta_feed: { headline: 40, primary: 125 },
  meta_story: { headline: 40, primary: 125 },
  meta_reel: { headline: 40, primary: 125 },
  google_rsa: { headline: 30, primary: 90 },
};

export function checkCharLimits(copy: { headline?: string | null; primary?: string | null }, placement: keyof typeof LIMITS | string): PlatformCheck[] {
  const lim = LIMITS[placement] ?? LIMITS.meta_feed;
  const out: PlatformCheck[] = [];
  const h = (copy.headline ?? "").trim();
  const p = (copy.primary ?? "").trim();
  if (h.length > lim.headline) out.push({ name: "headline-length", pass: false, severity: "warning", detail: `Headline ${h.length} chars > ${lim.headline}; ${placement} will truncate it.` });
  if (p.length > lim.primary) out.push({ name: "primary-length", pass: false, severity: "warning", detail: `Body ${p.length} chars > ${lim.primary}; ${placement} will cut it with an ellipsis.` });
  return out;
}

// Effective on-screen font size = the composed font px scaled to the device display height. A story shown at
// ~640px tall from a 1920px canvas scales text down 3x - a "24px" title becomes 8px and is unreadable.
const MIN_DISPLAY_PX = 12; // below this, mobile viewers can't read it
export function checkMinFont(fontPx: number, canvasHeight: number, displayHeight = 640): PlatformCheck {
  if (!(fontPx > 0) || !(canvasHeight > 0)) return { name: "min-font", pass: true, severity: "warning", detail: "no font size to check" };
  const effective = fontPx * (displayHeight / canvasHeight);
  const pass = effective >= MIN_DISPLAY_PX;
  return { name: "min-font", pass, severity: pass ? "warning" : "critical", detail: pass ? `~${effective.toFixed(0)}px on a phone - legible.` : `~${effective.toFixed(0)}px on a phone (< ${MIN_DISPLAY_PX}px) - too small to read.` };
}

// Vertical placements (9:16 story/reel) hide the top ~14% and bottom ~20% behind the profile row and the CTA.
// Any critical text overlapping those bands can be clipped by the UI. `textTopFrac`/`textBottomFrac` are the
// text block's top/bottom as fractions of height (0=top, 1=bottom).
export function checkSafeZone(textTopFrac: number, textBottomFrac: number, placement: string): PlatformCheck {
  const vertical = placement.includes("story") || placement.includes("reel");
  if (!vertical) return { name: "safe-zone", pass: true, severity: "warning", detail: "not a vertical placement" };
  const TOP = 0.14;
  const BOTTOM = 0.8; // content below this (bottom 20%) sits under the CTA/caption UI
  const clippedTop = textTopFrac < TOP;
  const clippedBottom = textBottomFrac > BOTTOM;
  const pass = !clippedTop && !clippedBottom;
  return { name: "safe-zone", pass, severity: pass ? "warning" : "critical", detail: pass ? "text is inside the story/reel safe zone." : `text ${clippedTop ? "near the top" : ""}${clippedTop && clippedBottom ? " and " : ""}${clippedBottom ? "near the bottom" : ""} can be hidden behind the ${placement} UI.` };
}
