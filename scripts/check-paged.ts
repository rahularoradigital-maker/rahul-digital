// Runnable check for lib/supabase/paged.ts (the parallel-burst store reader).
// Run: npm run check:paged

import { strict as assert } from "node:assert";
import { readAllPages } from "../lib/supabase/paged.ts";

// A fake table of N rows in a total order; records each range requested and how many were in flight together.
function table(n: number, size: number) {
  const calls: [number, number][] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const page = (from: number, to: number) => {
    calls.push([from, to]);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise<{ data: number[]; error: null }>((resolve) =>
      setTimeout(() => {
        inFlight--;
        const data: number[] = [];
        for (let i = from; i <= Math.min(to, n - 1); i++) data.push(i);
        resolve({ data, error: null });
      }, 1),
    );
  };
  return { page, calls, max: () => maxInFlight, size };
}

async function main() {
  // 1. Small account: one page, exactly one query (no burst fired).
  {
    const t = table(10, 100);
    const rows = await readAllPages(t.page, { size: 100, burst: 4 });
    assert.deepEqual(rows, Array.from({ length: 10 }, (_, i) => i));
    assert.equal(t.calls.length, 1, "a short first page must not trigger a burst");
  }
  // 2. Exactly one full page: page 1 full -> one burst fired, stops at the first short (empty) page.
  {
    const t = table(100, 100);
    const rows = await readAllPages(t.page, { size: 100, burst: 4 });
    assert.equal(rows.length, 100);
    assert.equal(t.calls.length, 1 + 4);
  }
  // 3. Many pages: every row exactly once, in order, with pages actually in flight together.
  {
    const t = table(2350, 100);
    const rows = await readAllPages(t.page, { size: 100, burst: 4 });
    assert.equal(rows.length, 2350);
    assert.deepEqual(rows, Array.from({ length: 2350 }, (_, i) => i), "rows must be complete and in range order");
    assert.ok(t.max() >= 4, `burst pages must run in parallel (max in flight ${t.max()})`);
    // 1 (first) + bursts of 4 covering ranges 100..2400 -> ranges 100,200,...,2400 = 24 pages -> 6 bursts = 24 calls
    assert.equal(t.calls.length, 1 + 24);
  }
  // 4. Errors surface (a caller that previously swallowed errors must wrap it).
  {
    let threw = false;
    try {
      await readAllPages<number>(async () => ({ data: null, error: { message: "boom" } }), { size: 10 });
    } catch (e) {
      threw = (e as Error).message === "boom";
    }
    assert.ok(threw, "a page error must throw with its message");
  }
  console.log("PASS: paged reader (single-page short-circuit, burst parallelism, completeness + order, error surfacing)");
}

main().catch((e) => {
  console.error("FAIL: paged reader:", e);
  process.exit(1);
});
