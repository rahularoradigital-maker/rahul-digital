// Tenant access rules - PURE (no DB, no server-only) so they can be unit-tested directly. A bug here leaks
// one client's data to another agency member, so this is the most security-sensitive logic in the app and
// is exercised by scripts/check-tenancy.ts.

export type OrgRole = "owner" | "admin" | "member" | "viewer";
export type BrandRole = "editor" | "viewer";

// The brand IDs a user can see within ONE org: owner/admin see every brand; member/viewer see only the
// brands explicitly granted to them (brand_members). Never returns a brand outside orgBrandIds, so a stale
// or forged grant to a brand in another org can never widen access.
export function brandsVisibleTo(orgRole: OrgRole, orgBrandIds: string[], grantedBrandIds: string[]): string[] {
  if (orgRole === "owner" || orgRole === "admin") return [...orgBrandIds];
  const granted = new Set(grantedBrandIds);
  return orgBrandIds.filter((id) => granted.has(id));
}

// Whether the user can EDIT (vs only view) within a brand: owner/admin always; otherwise the per-brand
// grant's role. A member with no grant for the brand cannot edit (and shouldn't even see it).
export function canEditBrand(orgRole: OrgRole, brandRole: BrandRole | null): boolean {
  if (orgRole === "owner" || orgRole === "admin") return true;
  return brandRole === "editor";
}
