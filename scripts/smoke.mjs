// Production smoke test (ISSUE 30). Dependency-free; hits the PUBLIC surface only, so it needs no
// credentials and is safe to run on a schedule / before a release:
//   npm run smoke            # against production
//   npm run smoke -- https://staging.example.com
// It catches the failures a green build + green check:all cannot: a broken deploy (pages 500), a
// dropped/weakened security header, a broken auth gate (/app reachable unauthenticated), or the dead
// Claude route resurrected. The signed-in flows (cockpit, Ask, account switch, competitor refresh)
// need a dedicated test account in CI secrets - a Rahul action - and are intentionally NOT here.
const BASE = (process.argv[2] || process.env.SMOKE_BASE || "https://rahul-digital.vercel.app").replace(/\/$/, "");

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check("marketing page loads", async () => {
  const r = await fetch(`${BASE}/product`, { redirect: "manual" });
  if (r.status !== 200) throw new Error(`GET /product -> ${r.status} (want 200)`);
});

check("login page loads", async () => {
  const r = await fetch(`${BASE}/login`, { redirect: "manual" });
  if (r.status !== 200) throw new Error(`GET /login -> ${r.status} (want 200)`);
});

check("CSP is enforced (not report-only)", async () => {
  const r = await fetch(`${BASE}/product`, { redirect: "manual" });
  if (!r.headers.get("content-security-policy")) throw new Error("missing enforced Content-Security-Policy header");
  for (const d of ["object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"]) {
    if (!(r.headers.get("content-security-policy") || "").includes(d)) throw new Error(`CSP missing directive: ${d}`);
  }
});

check("baseline security headers present", async () => {
  const r = await fetch(`${BASE}/product`, { redirect: "manual" });
  for (const h of ["strict-transport-security", "x-content-type-options"]) {
    if (!r.headers.get(h)) throw new Error(`missing header: ${h}`);
  }
});

check("auth gate: /app redirects unauthenticated", async () => {
  const r = await fetch(`${BASE}/app`, { redirect: "manual" });
  if (r.status < 300 || r.status >= 400) throw new Error(`GET /app (unauth) -> ${r.status} (want a redirect to /login)`);
});

check("dead Claude route stays gone", async () => {
  const r = await fetch(`${BASE}/api/health/claude`, { redirect: "manual" });
  if (r.status !== 404) throw new Error(`/api/health/claude -> ${r.status} (want 404)`);
});

let failed = 0;
for (const { name, fn } of checks) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL ${name}: ${e instanceof Error ? e.message : e}`);
  }
}
console.log(`\n[smoke] ${checks.length - failed}/${checks.length} passed against ${BASE}`);
if (failed) process.exit(1);
