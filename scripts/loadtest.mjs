// Lightweight load-test harness for AdBrain. No dependencies (native fetch). Hits a list of PUBLIC GET
// endpoints at a bounded concurrency and reports latency percentiles + status distribution, so you can see
// the app's baseline and where it bends before real traffic.
//
// SAFE BY DEFAULT: low count/concurrency, public read-only pages only (no auth, no writes, no mutations).
// Do NOT point the heavy settings at production; use a preview/staging deploy for real load. The prompt's
// rule stands: no destructive production load tests.
//
// Usage:
//   node scripts/loadtest.mjs                          # gentle smoke vs SMOKE_BASE or the live site
//   BASE=https://<preview-url> COUNT=500 CONCURRENCY=25 node scripts/loadtest.mjs
//
// Env: BASE (default https://adscaledigital.co), COUNT (default 30), CONCURRENCY (default 5),
//      PATHS (comma-separated, default the public set below).

const BASE = process.env.BASE || process.env.SMOKE_BASE || "https://adscaledigital.co";
const COUNT = Number(process.env.COUNT || 30);
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const PATHS = (process.env.PATHS || "/,/product,/privacy,/api/health,/sitemap.xml").split(",").map((p) => p.trim());

const results = []; // { path, ms, status, ok }

async function one(path) {
  const url = `${BASE}${path}`;
  const t0 = performance.now();
  try {
    const res = await fetch(url, { redirect: "manual" });
    const ms = performance.now() - t0;
    // Drain the body so timing includes transfer, then discard.
    await res.arrayBuffer().catch(() => {});
    results.push({ path, ms, status: res.status, ok: res.status < 500 });
  } catch (e) {
    results.push({ path, ms: performance.now() - t0, status: 0, ok: false, err: String(e).slice(0, 80) });
  }
}

// Build the job list (COUNT requests spread round-robin across PATHS), then run with a bounded worker pool.
const jobs = Array.from({ length: COUNT }, (_, i) => PATHS[i % PATHS.length]);

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

async function run() {
  console.log(`Load test: ${BASE}  count=${COUNT} concurrency=${CONCURRENCY}  paths=${PATHS.join(", ")}\n`);
  const queue = [...jobs];
  const t0 = performance.now();
  async function worker() {
    for (;;) {
      const path = queue.shift();
      if (!path) return;
      await one(path);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  const wall = (performance.now() - t0) / 1000;

  // Per-path summary.
  const byPath = {};
  for (const r of results) (byPath[r.path] ||= []).push(r);
  console.log("path".padEnd(16), "n".padStart(4), "ok".padStart(4), "p50".padStart(6), "p95".padStart(6), "max".padStart(6));
  for (const p of PATHS) {
    const rs = byPath[p] || [];
    const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
    const okN = rs.filter((r) => r.ok).length;
    console.log(p.padEnd(16), String(rs.length).padStart(4), String(okN).padStart(4), String(pct(ms, 50)).padStart(6), String(pct(ms, 95)).padStart(6), String(Math.round(ms[ms.length - 1] || 0)).padStart(6));
  }

  const allMs = results.map((r) => r.ms).sort((a, b) => a - b);
  const errors = results.filter((r) => !r.ok);
  const statuses = results.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  console.log(`\nTotals: ${results.length} reqs in ${wall.toFixed(1)}s  (~${(results.length / wall).toFixed(1)} req/s)`);
  console.log(`Latency ms: p50=${pct(allMs, 50)} p95=${pct(allMs, 95)} p99=${pct(allMs, 99)} max=${Math.round(allMs[allMs.length - 1] || 0)}`);
  console.log(`Status:`, statuses);
  if (errors.length) {
    console.log(`\n${errors.length} error(s) (status>=500 or network):`);
    for (const e of errors.slice(0, 10)) console.log(`  ${e.path} -> ${e.status} ${e.err || ""}`);
  }
  console.log(errors.length === 0 ? "\nLOADTEST OK (no 5xx / network errors)" : `\nLOADTEST issues: ${errors.length}`);
  process.exit(errors.length === 0 ? 0 : 1);
}

run();
