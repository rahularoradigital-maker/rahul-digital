// Proof for the RBAC matrix: least-privilege holds, and platform-level powers are granted to NO tenant role.
// Run: node --experimental-strip-types scripts/check-rbac.ts

import { can, requirePermission, PermissionError, CONTROL_PLANE_ONLY, PERMISSIONS } from "../lib/security/rbac.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// role gradients
ok(can("owner", "brands.edit"), "owner can edit brands");
ok(can("member", "brands.edit"), "member can edit brands");
ok(!can("viewer", "brands.edit"), "viewer CANNOT edit brands");
ok(can("viewer", "brands.read"), "viewer can read brands");
ok(!can(null, "brands.read"), "no role -> no permission");
ok(!can(undefined, "brands.read"), "undefined role -> no permission");

// least privilege: NO tenant role holds any control-plane-only power
for (const role of ["owner", "admin", "member", "viewer"] as const) {
  for (const p of CONTROL_PLANE_ONLY) {
    ok(!can(role, p), `${role} must NOT hold control-plane power ${p}`);
  }
}

// dangerous powers specifically denied to everyone here
for (const role of ["owner", "admin", "member", "viewer"] as const) {
  ok(!can(role, "credits.grant"), `${role} cannot grant credits`);
  ok(!can(role, "killswitch.execute"), `${role} cannot execute kill switch`);
  ok(!can(role, "billing.refund"), `${role} cannot refund`);
  ok(!can(role, "rules.publish"), `${role} cannot publish rules`);
}

// requirePermission throws the typed error
let threw = false;
try {
  requirePermission("viewer", "brands.edit");
} catch (e) {
  threw = e instanceof PermissionError && e.permission === "brands.edit";
}
ok(threw, "requirePermission throws PermissionError for a denied action");
requirePermission("owner", "brands.edit"); // must NOT throw
pass++;

// catalog integrity: every CONTROL_PLANE_ONLY permission is a real permission
ok(CONTROL_PLANE_ONLY.every((p) => (PERMISSIONS as readonly string[]).includes(p)), "control-plane-only list references only real permissions");

console.log(`check-rbac: ${pass} assertions passed.`);
