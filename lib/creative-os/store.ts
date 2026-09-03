import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreativePattern, PatternType, Opportunity } from "@/lib/creative-os/schema";
import type { PatternDraft } from "@/lib/creative-os/extract-pure";

// Creative Database store (Phase 2+). Service-role admin client, ALWAYS user-scoped (the app-level tenancy
// discipline — creative_patterns/opportunities are RLS default-deny). Best-effort writes never throw.

function rowToPattern(r: Record<string, unknown>): CreativePattern {
  return {
    id: String(r.id),
    brandId: (r.brand_id as string) ?? null,
    type: r.type as PatternType,
    text: String(r.text),
    source: r.source as CreativePattern["source"],
    sourceRef: (r.source_ref as string) ?? null,
    performance: (r.performance as CreativePattern["performance"]) ?? null,
    evidence: (r.evidence as Record<string, unknown> | null) ?? null,
    createdAt: String(r.created_at),
  };
}

// Insert a batch of extracted patterns for a user. Returns how many landed. Never throws (a bad batch is logged).
export async function savePatterns(userId: string, drafts: PatternDraft[]): Promise<number> {
  if (!drafts.length) return 0;
  const rows = drafts.map((d) => ({
    user_id: userId,
    brand_id: d.brandId,
    type: d.type,
    text: d.text,
    source: d.source,
    source_ref: d.sourceRef,
    performance: d.performance,
    evidence: d.evidence,
  }));
  const { data, error } = await createAdminClient().from("creative_patterns").insert(rows).select("id");
  if (error) {
    console.error("[creative-os] savePatterns failed (recoverable)", error.message);
    return 0;
  }
  return (data ?? []).length;
}

// Read a user's patterns, optionally filtered by brand + type. Newest first, bounded.
export async function loadPatterns(
  userId: string,
  opts: { brandId?: string | null; type?: PatternType; limit?: number } = {},
): Promise<CreativePattern[]> {
  let q = createAdminClient()
    .from("creative_patterns")
    .select("id,brand_id,type,text,source,source_ref,performance,evidence,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 500);
  if (opts.brandId !== undefined) q = q.eq("brand_id", opts.brandId);
  if (opts.type) q = q.eq("type", opts.type);
  const { data } = await q;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToPattern);
}

function rowToOpportunity(r: Record<string, unknown>): Opportunity {
  return {
    id: String(r.id),
    brandId: String(r.brand_id),
    persona: (r.persona as string) ?? null,
    angle: (r.angle as string) ?? null,
    format: (r.format as string) ?? null,
    thesis: String(r.thesis),
    evidence: (r.evidence as Opportunity["evidence"]) ?? null,
    confidence: Number(r.confidence ?? 0),
    status: r.status as Opportunity["status"],
    createdAt: String(r.created_at),
  };
}

export async function saveOpportunities(userId: string, brandId: string, opps: Omit<Opportunity, "id" | "createdAt" | "brandId">[]): Promise<number> {
  if (!opps.length) return 0;
  const rows = opps.map((o) => ({
    user_id: userId,
    brand_id: brandId,
    persona: o.persona,
    angle: o.angle,
    format: o.format,
    thesis: o.thesis,
    evidence: o.evidence,
    confidence: o.confidence,
    status: o.status,
  }));
  const { data, error } = await createAdminClient().from("opportunities").insert(rows).select("id");
  if (error) {
    console.error("[creative-os] saveOpportunities failed (recoverable)", error.message);
    return 0;
  }
  return (data ?? []).length;
}

export async function loadOpportunities(userId: string, brandId: string, limit = 50): Promise<Opportunity[]> {
  const { data } = await createAdminClient()
    .from("opportunities")
    .select("id,brand_id,persona,angle,format,thesis,evidence,confidence,status,created_at")
    .eq("user_id", userId)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map(rowToOpportunity);
}
