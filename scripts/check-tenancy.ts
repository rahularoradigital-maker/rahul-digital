// Runnable check for the tenant access rules (lib/tenancy/access.ts). This is the isolation boundary between
// agencies/brands, so it is tested directly. node --experimental-strip-types scripts/check-tenancy.ts
import assert from "node:assert/strict";
import { brandsVisibleTo, canEditBrand } from "../lib/tenancy/access.ts";

const orgBrands = ["soch", "nike", "boat", "aurelia"];

// owner/admin see every brand in the org, regardless of (or without) per-brand grants.
assert.deepEqual(brandsVisibleTo("owner", orgBrands, []).sort(), [...orgBrands].sort(), "owner sees all brands");
assert.deepEqual(brandsVisibleTo("admin", orgBrands, ["soch"]).sort(), [...orgBrands].sort(), "admin sees all brands");

// member/viewer see ONLY the brands granted to them (the client-confidentiality boundary).
assert.deepEqual(brandsVisibleTo("member", orgBrands, ["soch", "nike"]).sort(), ["nike", "soch"], "member sees only granted brands");
assert.deepEqual(brandsVisibleTo("viewer", orgBrands, ["boat"]), ["boat"], "viewer sees only granted brands");
assert.deepEqual(brandsVisibleTo("member", orgBrands, []), [], "member with no grants sees nothing");

// A grant to a brand OUTSIDE this org can never widen access (never returns an id not in orgBrands).
assert.deepEqual(brandsVisibleTo("member", orgBrands, ["soch", "some-other-orgs-brand"]), ["soch"], "a foreign brand grant cannot leak in");

// Edit rights: owner/admin always; member/viewer only when their brand grant is 'editor'.
assert.equal(canEditBrand("owner", null), true, "owner can edit");
assert.equal(canEditBrand("admin", null), true, "admin can edit");
assert.equal(canEditBrand("member", "editor"), true, "granted editor can edit");
assert.equal(canEditBrand("member", "viewer"), false, "granted viewer cannot edit");
assert.equal(canEditBrand("member", null), false, "member with no brand grant cannot edit");

console.log("PASS: tenancy access rules");
