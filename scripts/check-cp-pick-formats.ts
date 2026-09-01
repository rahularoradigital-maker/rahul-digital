// Runnable check for lib/creative-production/formats/pick.ts (format subset + safe fallback).
// Run: node --experimental-strip-types scripts/check-cp-pick-formats.ts
import assert from "node:assert/strict";
import { pickFormats } from "../lib/creative-production/formats/pick.ts";

const base = [{ id: "a" }, { id: "b" }, { id: "c" }];

assert.deepEqual(pickFormats(base, undefined), base, "no ids -> full set");
assert.deepEqual(pickFormats(base, []), base, "empty ids -> full set");
assert.deepEqual(pickFormats(base, null), base, "null ids -> full set");
assert.deepEqual(pickFormats(base, ["a", "c"]).map((f) => f.id), ["a", "c"], "subset filters correctly");
assert.deepEqual(pickFormats(base, ["zzz"]), base, "no match -> falls back to full set (never zero)");
assert.deepEqual(pickFormats(base, ["b", "zzz"]).map((f) => f.id), ["b"], "partial match keeps the valid ones");

console.log("PASS: check-cp-pick-formats (subset + safe fallback, never generates zero)");
