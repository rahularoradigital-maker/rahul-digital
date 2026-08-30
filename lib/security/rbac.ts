// RBAC permission catalog + role->permission matrix. The app already has tenancy ROLES
// (owner/admin/member/viewer per lib/tenancy/access.ts) but no PERMISSION model - so "can this role publish a
// rule / grant credits / rotate a credential?" had no answer and privileged actions were gated only by
// "is signed in". This is the granular catalog (section 6 of the control-plane spec) + a pure can() check.
// Pure, no I/O - unit-testable (scripts/check-rbac.ts). Enforcement calls can(role, perm) at each guarded path.

import type { OrgRole } from "../tenancy/access.ts";

// Granular, least-privilege permissions. Dotted resource.verb. Add here, never inline a string at a call site.
export const PERMISSIONS = [
  "users.read",
  "users.suspend",
  "organizations.read",
  "billing.read",
  "billing.refund",
  "credits.read",
  "credits.grant",
  "credits.revoke",
  "brands.read",
  "brands.edit",
  "rules.read",
  "rules.edit",
  "rules.publish",
  "prompts.read",
  "prompts.edit",
  "prompts.publish",
  "credentials.read_metadata",
  "credentials.rotate",
  "connectors.manage",
  "security.read",
  "audit.read",
  "killswitch.execute",
  "feature_flags.manage",
  "data.export",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// What each tenant role may do WITHIN its own org. Deliberately least-privilege: nobody gets a blanket grant,
// and platform-level powers (credits, kill switches, publishing, refunds, credential rotation) are NOT granted
// to any tenant role here - those belong to a separate internal control-plane admin role, added when that
// plane exists. A tenant "owner" is the owner of THEIR data, not a super-admin over the platform.
const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  owner: ["organizations.read", "brands.read", "brands.edit", "rules.read", "prompts.read", "credentials.read_metadata", "connectors.manage", "billing.read", "credits.read", "data.export", "users.read"],
  admin: ["organizations.read", "brands.read", "brands.edit", "rules.read", "prompts.read", "credentials.read_metadata", "connectors.manage", "billing.read", "credits.read", "users.read"],
  member: ["brands.read", "brands.edit", "rules.read", "prompts.read"],
  viewer: ["brands.read", "rules.read", "prompts.read"],
};

/** Does this tenant role hold this permission? The single source of truth for tenant-level authorization. */
export function can(role: OrgRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Throw if the role lacks the permission. Use to gate a write/dangerous path server-side. */
export class PermissionError extends Error {
  permission: Permission;
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionError";
    this.permission = permission;
  }
}
export function requirePermission(role: OrgRole | null | undefined, permission: Permission): void {
  if (!can(role, permission)) throw new PermissionError(permission);
}

// Permissions no tenant role currently holds - they require a separate control-plane admin identity. Exposed
// so the gap is explicit and testable, not forgotten.
export const CONTROL_PLANE_ONLY: readonly Permission[] = ["credits.grant", "credits.revoke", "billing.refund", "rules.publish", "prompts.publish", "prompts.edit", "rules.edit", "credentials.rotate", "killswitch.execute", "feature_flags.manage", "security.read", "audit.read", "users.suspend"];
