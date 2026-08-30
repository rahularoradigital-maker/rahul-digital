import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { brandsVisibleTo, type OrgRole } from "./access";

// The single source of truth for "what is this user allowed to see". Resolves the user's org memberships,
// per-brand grants, the brands they can access (honoring brandsVisibleTo), and the platform accounts under
// those brands. Reads should scope to ctx.accounts / ctx.brands and NEVER trust a brandId/accountId from
// the client without checking it is in here first.

export type BrandRef = { id: string; name: string; orgId: string; orgName: string; orgRole: OrgRole };
export type AccountRef = { id: string; externalId: string; platform: string; name: string | null; brandId: string | null; isActive: boolean };
export type UserContext = { userId: string; brands: BrandRef[]; accounts: AccountRef[] };

export async function resolveUserContext(userId: string): Promise<UserContext> {
  const admin = createAdminClient();

  const { data: memberships } = await admin.from("org_members").select("org_id, role").eq("user_id", userId);
  if (!memberships || memberships.length === 0) return { userId, brands: [], accounts: [] };
  const orgIds = memberships.map((m) => m.org_id as string);
  const roleByOrg = new Map<string, OrgRole>(memberships.map((m) => [m.org_id as string, m.role as OrgRole]));

  const [{ data: orgs }, { data: grants }, { data: brandRows }] = await Promise.all([
    admin.from("orgs").select("id, name").in("id", orgIds),
    admin.from("brand_members").select("brand_id").eq("user_id", userId),
    admin.from("brands").select("id, name, org_id").in("org_id", orgIds),
  ]);
  const orgName = new Map<string, string>((orgs ?? []).map((o) => [o.id as string, (o.name as string) ?? ""]));
  const grantedBrandIds = (grants ?? []).map((g) => g.brand_id as string);
  const allBrands = (brandRows ?? []) as { id: string; name: string; org_id: string }[];

  const brands: BrandRef[] = [];
  for (const orgId of orgIds) {
    const role = roleByOrg.get(orgId) ?? "viewer";
    const orgBrandIds = allBrands.filter((b) => b.org_id === orgId).map((b) => b.id);
    const visible = new Set(brandsVisibleTo(role, orgBrandIds, grantedBrandIds));
    for (const b of allBrands) {
      if (b.org_id === orgId && visible.has(b.id)) brands.push({ id: b.id, name: b.name, orgId, orgName: orgName.get(orgId) ?? "", orgRole: role });
    }
  }

  const brandIds = brands.map((b) => b.id);
  let accounts: AccountRef[] = [];
  if (brandIds.length > 0) {
    const { data: acctRows } = await admin.from("ad_accounts").select("id, external_id, platform, name, brand_id, is_active").in("brand_id", brandIds);
    accounts = ((acctRows ?? []) as { id: string; external_id: string; platform: string; name: string | null; brand_id: string | null; is_active: boolean }[]).map((a) => ({
      id: a.id,
      externalId: a.external_id,
      platform: a.platform,
      name: a.name,
      brandId: a.brand_id,
      isActive: a.is_active,
    }));
  }
  return { userId, brands, accounts };
}

// Guard helpers - use these before acting on any client-supplied id.
export function canAccessBrand(ctx: UserContext, brandId: string): boolean {
  return ctx.brands.some((b) => b.id === brandId);
}
export function canAccessAccount(ctx: UserContext, accountExternalId: string): boolean {
  return ctx.accounts.some((a) => a.externalId === accountExternalId);
}
