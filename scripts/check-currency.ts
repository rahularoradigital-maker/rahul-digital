// Proof for the budget minor-unit divisor: 2-decimal currencies /100, zero-decimal /1, three-decimal /1000,
// unknown defaults to /100. A wrong divisor makes a JPY budget look 100x too small.
// Run: node --experimental-strip-types scripts/check-currency.ts

import { minorUnitDivisor } from "../lib/meta-source.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

ok(minorUnitDivisor("INR") === 100, "INR is 2-decimal (/100)");
ok(minorUnitDivisor("USD") === 100, "USD is 2-decimal (/100)");
ok(minorUnitDivisor("JPY") === 1, "JPY is zero-decimal (/1)");
ok(minorUnitDivisor("KRW") === 1, "KRW is zero-decimal (/1)");
ok(minorUnitDivisor("KWD") === 1000, "KWD is three-decimal (/1000)");
ok(minorUnitDivisor("jpy") === 1, "case-insensitive");
ok(minorUnitDivisor(null) === 100, "unknown/null defaults to /100 (safe INR-style)");
ok(minorUnitDivisor("ZZZ") === 100, "unrecognised code defaults to /100");

// Concrete: a JPY 5000/day budget is 5000 whole yen, not 50.
ok(5000 / minorUnitDivisor("JPY") === 5000, "JPY 5000 -> 5000 (not 50)");
ok(50000 / minorUnitDivisor("INR") === 500, "INR 50000 paise -> 500 rupees");

console.log(`check-currency: ${pass} assertions passed.`);
