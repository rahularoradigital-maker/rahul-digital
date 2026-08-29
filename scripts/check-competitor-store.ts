// Runnable check for lib/competitors/store.ts (ISSUE 02: non-destructive refresh). No env needed.
//   node --experimental-strip-types scripts/check-competitor-store.ts
// Verifies the ordering invariant with a stub admin: the stale-delete happens ONLY after a successful
// write, and NEVER when a write fails - so a failed refresh cannot destroy last-known-good data.
import { strict as assert } from "node:assert";
import { storeCompetitorBrandAds } from "../lib/competitors/store.ts";

// Minimal chainable stub of the supabase admin client. Records the sequence of operations so we can
// assert delete-after-write ordering. `adsUpsertError` simulates a failed ad write.
function makeAdmin(adsUpsertError: unknown = null) {
  const ops: string[] = [];
  const deleteBuilder = () => {
    const b: Record<string, unknown> = {};
    for (const m of ["eq", "is", "not"]) b[m] = () => b;
    (b as { then: unknown }).then = (res: (v: unknown) => unknown) => {
      ops.push("delete");
      return Promise.resolve({ error: null }).then(res);
    };
    return b;
  };
  const admin = {
    from: (table: string) => ({
      upsert: (_rows: unknown, _opts?: unknown) => {
        ops.push(`upsert:${table}`);
        return Promise.resolve({ error: table === "competitor_ads" ? adsUpsertError : null });
      },
      delete: () => deleteBuilder(),
    }),
  };
  return { admin: admin as unknown as Parameters<typeof storeCompetitorBrandAds>[0], ops };
}

const ad = (id: string) => ({ pageId: "p1", adArchiveId: id, isMyBrand: false, brandLabel: "B", isActive: true, displayFormat: "IMAGE", media: "image", ctaText: null, ctaType: null, title: null, body: null, linkUrl: null, platforms: [], startDate: null, endDate: null, cardCount: 1, adUrl: null, imageUrl: null, videoUrl: null, videoThumbUrl: null }) as unknown as Parameters<typeof storeCompetitorBrandAds>[1]["ads"][number];
const base = { userId: "u1", accountId: "act_1", pageId: "p1", isMyBrand: false, label: "B", adLibraryUrl: "http://x" };

// 1) Success with a non-empty set: both upserts run, THEN the stale delete - delete is last.
{
  const { admin, ops } = makeAdmin();
  await storeCompetitorBrandAds(admin, { ...base, ads: [ad("1"), ad("2")] });
  assert.ok(ops.includes("upsert:competitor_ads") && ops.includes("upsert:competitor_brands"), "both upserts ran");
  assert.equal(ops[ops.length - 1], "delete", "delete happens LAST, after the writes");
}

// 2) Ad upsert FAILS: it throws and NO delete is issued -> old data survives.
{
  const { admin, ops } = makeAdmin({ message: "boom" });
  await assert.rejects(() => storeCompetitorBrandAds(admin, { ...base, ads: [ad("1")] }), /competitor write failed/, "throws on write failure");
  assert.ok(!ops.includes("delete"), "no delete when the write failed (last-known-good preserved)");
}

// 3) Empty set (genuine/spurious zero): brand row is written but NO delete -> brand not wiped.
{
  const { admin, ops } = makeAdmin();
  await storeCompetitorBrandAds(admin, { ...base, ads: [] });
  assert.ok(ops.includes("upsert:competitor_brands"), "brand row still updated");
  assert.ok(!ops.includes("delete"), "empty pull does not delete existing ads");
}

console.log("PASS: competitor refresh is non-destructive (write->verify->delete, never delete on failure/empty)");
