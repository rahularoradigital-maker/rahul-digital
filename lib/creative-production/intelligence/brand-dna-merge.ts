// Brand DNA merge (Phase 4) — PURE (no I/O). Effective Brand DNA = the machine-derived DNA with any user
// override field winning. "Use Brand Defaults" = pass override=null (drops all overrides losslessly, since
// derived + override are stored separately). Gate-tested by scripts/check-cp-brand-merge.ts.
import type { BrandDNA, BrandDNAOverride } from "@/lib/creative-production/types";

export function mergeBrandDNA(derived: BrandDNA, override: BrandDNAOverride | null): BrandDNA {
  if (!override) return { ...derived, source: "derived" };
  return {
    ...derived,
    palette: { ...derived.palette, ...(override.palette ?? {}) },
    fonts: { ...derived.fonts, ...(override.fonts ?? {}) },
    logoUrl: override.logoUrl ?? derived.logoUrl,
    imageStyle: override.imageStyle ?? derived.imageStyle,
    designStyle: override.designStyle ?? derived.designStyle,
    ctaStyle: override.ctaStyle ?? derived.ctaStyle,
    tone: override.tone ?? derived.tone,
    density: override.density ?? derived.density,
    source: "mixed",
  };
}

// A safe empty Brand DNA (everything UNKNOWN) so the pipeline never crashes when nothing is derived yet.
export function emptyBrandDNA(): BrandDNA {
  const U = "UNKNOWN" as const;
  return {
    palette: { primary: U, secondary: U, background: U, text: U },
    fonts: { heading: U, body: U },
    logoUrl: null,
    imageStyle: U,
    designStyle: U,
    ctaStyle: U,
    tone: U,
    density: U,
    source: "derived",
    version: 1,
  };
}
