import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveBrandId } from "@/lib/tenancy/resolve";
import { computeCoverage, type Coverage } from "@/lib/creative-production/formats/format-coverage.ts";

// Creative Studio - load format test-coverage for the CURRENT brand. "Tested" = a format that has actually
// produced a generated asset (cp_assets), not merely a scored concept. Maps each asset's concept -> the
// executional formatId it used, then delegates to the pure computeCoverage(). Brand-isolated.
export async function loadFormatCoverage(userId: string): Promise<Coverage> {
  const brandId = await getActiveBrandId(userId);
  if (!brandId) return computeCoverage([]);
  const admin = createAdminClient();

  // Which concepts have produced an asset for this brand.
  const { data: assets } = await admin
    .from("cp_assets")
    .select("concept_id")
    .eq("user_id", userId)
    .eq("brand_id", brandId)
    .limit(2000);
  const conceptIds = [...new Set((assets ?? []).map((a) => a.concept_id as string).filter(Boolean))];
  if (!conceptIds.length) return computeCoverage([]);

  // Resolve those concepts to their executional formatId.
  const { data: concepts } = await admin
    .from("cp_concepts")
    .select("concept")
    .eq("user_id", userId)
    .eq("brand_id", brandId)
    .in("id", conceptIds);
  const formatIds = (concepts ?? [])
    .map((c) => (c.concept as { formatId?: string } | null)?.formatId)
    .filter((id): id is string => !!id);

  return computeCoverage(formatIds);
}
