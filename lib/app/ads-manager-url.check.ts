// Runnable self-check for adsManagerUrl. Run: node --experimental-strip-types lib/app/ads-manager-url.check.ts
import assert from "node:assert";
import { adsManagerUrl } from "./ads-manager-url.ts";

// Builds an account-scoped, ad-selected Ads Manager link from bare numeric ids.
assert.equal(
  adsManagerUrl("266769781", "120210000000000000"),
  "https://adsmanager.facebook.com/adsmanager/manage/ads?act=266769781&selected_ad_ids=120210000000000000",
);

// Missing either id yields null so the UI falls back to plain text (never a broken link).
assert.equal(adsManagerUrl(undefined, "123"), null);
assert.equal(adsManagerUrl("123", undefined), null);
assert.equal(adsManagerUrl("", "123"), null);

console.log("PASS: ads-manager-url");
