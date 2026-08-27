// Runnable self-check for adsManagerUrl. Run: node --experimental-strip-types lib/app/ads-manager-url.check.ts
import assert from "node:assert";
import { adsManagerUrl } from "./ads-manager-url.ts";

// Builds an account-scoped, ad-filtered, ad-selected Ads Manager link from bare numeric ids.
const base = adsManagerUrl("266769781", "120210000000000000");
assert.ok(base);
assert.ok(base.startsWith("https://adsmanager.facebook.com/adsmanager/manage/ads?act=266769781"));
// filter_set carries the encoded ad.id filter so the table narrows to the exact ad.
assert.ok(base.includes("filter_set="));
assert.ok(base.includes(encodeURIComponent(JSON.stringify([{ field: "ad.id", operator: "IN", value: ["120210000000000000"] }]))));
// selected_ad_ids opens that ad selected.
assert.ok(base.includes("selected_ad_ids=120210000000000000"));
// No date param unless one is passed.
assert.ok(!base.includes("date="));

// A date window is threaded through as a date param (URL-encoded underscore stays "_").
const dated = adsManagerUrl("266769781", "120210000000000000", "2026-08-13_2026-08-27");
assert.ok(dated);
assert.ok(dated.includes("date=2026-08-13_2026-08-27"));

// Missing either id yields null so the UI falls back to plain text (never a broken link).
assert.equal(adsManagerUrl(undefined, "123"), null);
assert.equal(adsManagerUrl("123", undefined), null);
assert.equal(adsManagerUrl("", "123"), null);

console.log("PASS: ads-manager-url");
