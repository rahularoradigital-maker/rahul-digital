import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBrandId } from "@/lib/tenancy/resolve";
import { fetchWithTimeout } from "@/lib/http";
import { isPublicHttpsUrl } from "@/lib/ssrf";
import { deriveJSON } from "./llm-json.ts";
import { mergeBrandDNA, emptyBrandDNA } from "./brand-dna-merge.ts";
import type { BrandDNA, BrandDNAOverride } from "@/lib/creative-production/types";

// Brand Intelligence (Phase 4): derive a Brand DNA the pipeline uses as the default creative constraint.
// GROUNDED: colours/fonts/tone are read from the brand's OWN homepage text + Shopify shop name; nothing is
// invented (missing -> UNKNOWN, and the compositor falls back to safe defaults). The user can override any
// field in the Brand Control Panel; the effective DNA is merge(derived, override). "Use Brand Defaults"
// clears the override. derived + override are stored SEPARATELY so a reset is lossless.

const U = "UNKNOWN" as const;

// Best-effort fetch of the brand homepage, reduced to visible-ish text for the model to read.
async function fetchSiteText(url: string): Promise<string | null> {
  try {
    // Security (P0): this was the ONE external fetch without the SSRF guard every sibling applies. The
    // domain was validated only at connect time, so a later DNS re-point (or a stored http:// value) could
    // aim this at an internal/metadata address and feed the response into the LLM + storage. Force https
    // and re-check the resolved target at fetch time (isPublicHttpsUrl blocks private/loopback/metadata).
    const target = url.startsWith("http") ? url.replace(/^http:\/\//i, "https://") : `https://${url}`;
    if (!(await isPublicHttpsUrl(target))) return null;
    const res = await fetchWithTimeout(target, {}, 12_000);
    if (!res.ok) return null;
    const html = await res.text();
    // Pull colours the CSS actually declares (hex) + strip tags for tone/wording.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
    const hexes = Array.from(new Set((html.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toLowerCase()))).slice(0, 12);
    return `HEX COLOURS FOUND: ${hexes.join(", ") || "none"}\nPAGE TEXT: ${text}`;
  } catch {
    return null;
  }
}

function prompt(shopName: string | null, siteText: string | null): string {
  return [
    "You are a brand designer. From the brand's OWN homepage signals below, infer its visual identity.",
    'Use ONLY what the signals support. Anything you cannot ground, set to the exact string "UNKNOWN".',
    "Pick palette colours from the HEX list when present (primary = the dominant brand accent, not black/white).",
    shopName ? `Shop name: ${shopName}` : "",
    "Output JSON: {palette:{primary,secondary,background,text}, fonts:{heading,body}, imageStyle, designStyle, ctaStyle, tone, density}. density is one of low|medium|high|UNKNOWN.",
    "SIGNALS:",
    siteText ?? "none available",
  ].filter(Boolean).join("\n");
}

type Derived = {
  palette?: Partial<BrandDNA["palette"]>;
  fonts?: Partial<BrandDNA["fonts"]>;
  imageStyle?: string;
  designStyle?: string;
  ctaStyle?: string;
  tone?: string;
  density?: BrandDNA["density"];
};

export async function deriveBrandDNA(userId: string, scopeKey: string, opts: { websiteUrl: string | null; shopName: string | null }): Promise<BrandDNA> {
  const siteText = opts.websiteUrl ? await fetchSiteText(opts.websiteUrl) : null;
  const d = (await deriveJSON<Derived>(prompt(opts.shopName, siteText))) ?? {};
  const base = emptyBrandDNA();
  const derived: BrandDNA = {
    ...base,
    palette: {
      primary: d.palette?.primary ?? U,
      secondary: d.palette?.secondary ?? U,
      background: d.palette?.background ?? U,
      text: d.palette?.text ?? U,
    },
    fonts: { heading: d.fonts?.heading ?? U, body: d.fonts?.body ?? U },
    imageStyle: d.imageStyle ?? U,
    designStyle: d.designStyle ?? U,
    ctaStyle: d.ctaStyle ?? U,
    tone: d.tone ?? U,
    density: d.density ?? U,
    source: "derived",
    version: 1,
  };
  const admin = createAdminClient();
  // Bump version on each re-derive so downstream asset records can pin the exact brand version used.
  const { data: existing } = await admin.from("cp_brand_dna").select("version").eq("user_id", userId).eq("scope_key", scopeKey).maybeSingle();
  const version = (existing?.version ?? 0) + 1;
  derived.version = version;
  const brandId = await getActiveBrandId(userId); // tag with the current brand (scope_key already isolates via the brand's store)
  await admin
    .from("cp_brand_dna")
    .upsert({ user_id: userId, brand_id: brandId, scope_key: scopeKey, derived, version, updated_at: new Date().toISOString() }, { onConflict: "user_id,scope_key" })
    .then(undefined, () => {});
  return derived;
}

export async function saveBrandOverride(userId: string, scopeKey: string, override: BrandDNAOverride | null): Promise<void> {
  const brandId = await getActiveBrandId(userId);
  await createAdminClient()
    .from("cp_brand_dna")
    .upsert({ user_id: userId, brand_id: brandId, scope_key: scopeKey, override, updated_at: new Date().toISOString() }, { onConflict: "user_id,scope_key" })
    .then(undefined, () => {});
}

// The effective Brand DNA the whole pipeline consumes: derived with the user's override layered on top.
export async function loadEffectiveBrandDNA(userId: string, scopeKey: string): Promise<BrandDNA> {
  const { data } = await createAdminClient().from("cp_brand_dna").select("derived, override, version").eq("user_id", userId).eq("scope_key", scopeKey).maybeSingle();
  const derived = (data?.derived as BrandDNA) ?? emptyBrandDNA();
  const override = (data?.override as BrandDNAOverride | null) ?? null;
  const merged = mergeBrandDNA(derived, override);
  merged.version = data?.version ?? derived.version ?? 1;
  return merged;
}
