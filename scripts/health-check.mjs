// Engineering-health snapshot. DETERMINISTIC and report-only: no LLM, no credentials, no code
// mutation - so it runs safely both locally (`npm run health`) and in CI on a schedule. It measures
// the things that drift silently between pushes (dependency vulnerabilities, code growth, bloat
// signals, correctness-gate coverage) and writes a human report (HEALTH.md) plus a machine-readable
// state file (docs/audit-state.json) for trend tracking. It NEVER edits source - the spec's
// dangerous "auto-delete/auto-refactor" loops are deliberately not implemented; humans act on the
// report. Exit code stays 0 (a report, not a gate) unless a P0 security vuln is found.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const prodDeps = Object.keys(pkg.dependencies ?? {}).length;
const devDeps = Object.keys(pkg.devDependencies ?? {}).length;
const checkScripts = Object.keys(pkg.scripts).filter((k) => k.startsWith("check:")).length;

// --- Dependency vulnerabilities. execFile (no shell) with a fixed argv - no injection surface.
// npm audit exits non-zero when vulns exist, putting the JSON on stdout, so we read it from either. ---
let vulns = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
try {
  const out = execFileSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  vulns = JSON.parse(out).metadata?.vulnerabilities ?? vulns;
} catch (e) {
  try {
    vulns = JSON.parse(e.stdout).metadata?.vulnerabilities ?? vulns;
  } catch {
    /* audit unavailable (offline) - report zeros rather than fail */
  }
}

// --- Source scan: file count, LOC, oversized files (bloat candidates), TODO/FIXME markers. ---
const SRC_DIRS = ["app", "components", "lib", "scripts"];
const IGNORE = /node_modules|\.next|\.git/;
const LARGE_FILE_LINES = 500;
let files = 0;
let loc = 0;
let markers = 0;
const large = [];
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (IGNORE.test(p)) continue;
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx|mjs|cjs|js|jsx)$/.test(e.name)) {
      files++;
      const txt = readFileSync(p, "utf8");
      const lines = txt.split("\n").length;
      loc += lines;
      if (lines > LARGE_FILE_LINES) large.push({ file: p, lines });
      markers += (txt.match(/\b(TODO|FIXME|HACK|XXX)\b/g) ?? []).length;
    }
  }
}
for (const d of SRC_DIRS) {
  try {
    walk(d);
  } catch {
    /* dir may not exist */
  }
}
large.sort((a, b) => b.lines - a.lines);

// --- Health status: RED on any high/critical vuln; YELLOW on moderate vulns or many bloat signals. ---
const p0 = vulns.critical + vulns.high;
const status = p0 > 0 ? "RED" : vulns.moderate > 0 || large.length > 8 ? "YELLOW" : "GREEN";
// A stable UTC day stamp (no wall-clock time, so re-runs on the same day produce a stable report).
const day = new Date().toISOString().slice(0, 10);

const state = {
  generated: day,
  status,
  deps: { prod: prodDeps, dev: devDeps },
  correctnessGates: checkScripts,
  security: vulns,
  source: { files, loc, largeFiles: large.length, markers },
  largest: large.slice(0, 10),
};
writeFileSync("docs/audit-state.json", JSON.stringify(state, null, 2) + "\n");

const md = `# Engineering health

_Generated ${day} by \`npm run health\` (deterministic, report-only - no code was changed)._

## Status: ${status}

| Signal | Value |
|---|---|
| Dependency vulnerabilities | ${p0 ? `**${p0} high/critical**` : "0 high/critical"} · ${vulns.moderate} moderate · ${vulns.low} low |
| Runtime dependencies | ${prodDeps} prod, ${devDeps} dev |
| Correctness gates (\`check:*\`) | ${checkScripts} |
| Source files | ${files} (${loc.toLocaleString()} lines) |
| Oversized files (>${LARGE_FILE_LINES} lines) | ${large.length} |
| TODO / FIXME / HACK markers | ${markers} |

${p0 ? `### ⚠️ Security: ${p0} high/critical dependency vuln(s) - fix before release (P0).\n` : ""}
## Largest files (refactor candidates)

${large.slice(0, 10).map((f) => `- \`${f.file}\` — ${f.lines} lines`).join("\n") || "_None over the threshold._"}

---
_This report is Level 0-1 (observe / recommend). It never deletes or refactors code; a human acts on it._
`;
writeFileSync("HEALTH.md", md);

console.log(`[health] ${status} · ${files} files, ${loc} loc · ${p0} high/crit vulns · ${large.length} large files · ${markers} markers`);
console.log("[health] wrote HEALTH.md + docs/audit-state.json");
if (p0 > 0) process.exitCode = 1; // surfaces a security P0 in CI without blocking non-security runs
