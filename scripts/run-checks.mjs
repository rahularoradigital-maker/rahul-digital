// Phase 1 (master audit): run the SAME correctness gate as `check:all`, but in PARALLEL - one command
// instead of 165 serial `npm run` invocations. Each check is the exact `node --experimental-strip-types
// scripts/check-*.ts` the chain already runs, so the pass/fail is identical; only the wall-clock changes.
// Unlike the `&&` chain (which stops at the first failure), this runs ALL checks and reports EVERY failure,
// then exits non-zero if any failed - strictly more information, same gate.
//
// Usage: node scripts/run-checks.mjs   (wired as `npm run check`)
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const scripts = pkg.scripts ?? {};

// The declared gate is `check:all`. Take its exact ordered list of `npm run check:*` names so this runner
// and CI's `check:all` can never diverge - if a check is added to the chain, it is added here automatically.
const names = (scripts["check:all"] ?? "")
  .split("&&")
  .map((s) => s.trim().replace(/^npm run\s+/, ""))
  .filter((n) => n.startsWith("check:") && n !== "check:all");

const jobs = [...new Set(names)].map((name) => ({ name, cmd: scripts[name] })).filter((j) => j.cmd);
if (jobs.length === 0) {
  console.error("run-checks: could not extract any check:* jobs from check:all");
  process.exit(2);
}

const CONCURRENCY = Math.max(2, Math.min(os.cpus().length, 12));
const NOISE = /reparsing|eliminate this|trace-warnings|ExperimentalWarning|MODULE_TYPELESS|node --trace-warnings/i;

let next = 0;
let passed = 0;
const failures = [];

function runOne(job) {
  return new Promise((resolve) => {
    const [bin, ...args] = job.cmd.split(/\s+/); // e.g. node --experimental-strip-types scripts/check-x.ts
    const p = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("error", (e) => {
      failures.push({ name: job.name, out: String(e) });
      resolve();
    });
    p.on("close", (code) => {
      if (code === 0) passed++;
      else failures.push({ name: job.name, out });
      process.stdout.write(code === 0 ? "." : "F");
      resolve();
    });
  });
}

async function worker() {
  while (next < jobs.length) {
    const job = jobs[next++];
    await runOne(job);
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const secs = ((Date.now() - started) / 1000).toFixed(1);

console.log(`\n\n${passed}/${jobs.length} checks passed in ${secs}s (parallel x${CONCURRENCY}).`);

if (failures.length) {
  console.log(`\nFAILED (${failures.length}):`);
  for (const f of failures) {
    const tail = f.out.split("\n").filter((l) => l.trim() && !NOISE.test(l)).slice(-6).join("\n");
    console.log(`\n=== ${f.name} ===\n${tail}`);
  }
  process.exit(1);
}
console.log("ALL CHECKS GREEN");
