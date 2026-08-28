// Runnable check for lib/single-flight.ts (ISSUE 07). No env needed.
//   node --experimental-strip-types scripts/check-single-flight.ts
import { strict as assert } from "node:assert";
import { createSingleFlight } from "../lib/single-flight.ts";

const deferred = <V>() => {
  let resolve!: (v: V) => void, reject!: (e: unknown) => void;
  const promise = new Promise<V>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

// 1) N concurrent callers for the same key share ONE underlying call.
{
  const sf = createSingleFlight<number>();
  let calls = 0;
  const d = deferred<number>();
  const fn = () => { calls++; return d.promise; };
  const results = Promise.all(Array.from({ length: 20 }, () => sf("k", fn)));
  d.resolve(42);
  const vals = await results;
  assert.equal(calls, 1, "fn called exactly once for 20 concurrent callers");
  assert.ok(vals.every((v) => v === 42), "all callers get the same result");
}

// 2) After it settles, a new call re-invokes fn (not permanently cached).
{
  const sf = createSingleFlight<number>();
  let calls = 0;
  const fn = () => { calls++; return Promise.resolve(calls); };
  assert.equal(await sf("k", fn), 1, "first call");
  assert.equal(await sf("k", fn), 2, "second call re-runs after first settled");
}

// 3) A rejected call is not cached: the entry is cleared and the next call retries.
{
  const sf = createSingleFlight<number>();
  let calls = 0;
  const fn = () => { calls++; return calls === 1 ? Promise.reject(new Error("boom")) : Promise.resolve(99); };
  await assert.rejects(() => sf("k", fn), /boom/, "first rejects");
  assert.equal(await sf("k", fn), 99, "retry after rejection succeeds");
  assert.equal(calls, 2, "fn ran twice (no cached rejection)");
}

// 4) Different keys are independent.
{
  const sf = createSingleFlight<string>();
  const [a, b] = await Promise.all([sf("a", () => Promise.resolve("A")), sf("b", () => Promise.resolve("B"))]);
  assert.equal(a, "A");
  assert.equal(b, "B");
}

console.log("PASS: single-flight dedupes concurrent work, clears on settle, retries after rejection, isolates keys");
