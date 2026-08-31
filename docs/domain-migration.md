# Domain Migration Runbook — move AdBrain to a real `adbrain.*` domain

**Goal:** move the canonical domain from `adscaledigital.co` (current) to a proper
`adbrain.*` domain **without losing SEO**. Keep every existing URL alive as a `301`
permanent redirect so the link equity built on the old domain transfers to the new one.

**Why bother:** the current domain contains the dead brand word **"adscale"**. The product
is "AdBrain"; the codebase already runs a regression gate (`scripts/check-brand-consistency.ts`)
whose entire job is to keep the word *AdScale* out of the source, because it *"split the entity
across the site and confused search + answer engines."* Serving the whole site from a domain that
literally spells the old brand fights that same entity signal every day. A clean `adbrain.*`
domain makes the brand, the domain, and the schema.org `Organization`/`WebSite` entity all say the
same thing — which is exactly what answer engines reward.

**The one risk to manage:** the old domain has accrued crawl history, backlinks, and
Search Console signal. A naive cut-over throws that away. The whole plan below exists to
preserve it via `301`s + Google's Change of Address tool. Do the redirects first, keep them
for years, and the ranking follows the move instead of resetting.

---

## 0. How the code already handles the domain (read this first)

Good news: the app is almost entirely **env-driven**. One Vercel env var,
`NEXT_PUBLIC_SITE_URL`, drives canonicals, the sitemap, robots, Open Graph, and JSON-LD.
Change that one value and the SEO surface follows automatically — no code change needed for
the marketing/SEO layer.

### Env-driven (these follow `NEXT_PUBLIC_SITE_URL` automatically — no edit needed)

| File:line | What it controls |
|---|---|
| `app/layout.tsx:12` | `SITE_URL` → `metadata.metadataBase`, `alternates.canonical`, Open Graph `url`, and all three JSON-LD entities (`Organization`, `WebSite`, `SoftwareApplication`) |
| `app/sitemap.ts:4` | `SITE_URL` → every `<url>` in `/sitemap.xml` (static pages + published blog posts) |
| `app/robots.ts:3` | `SITE_URL` → the `Sitemap:` line in `/robots.txt` |
| `app/blog/[slug]/page.tsx:8` | `SITE_URL` → per-article canonical + OG URLs |

All four read `process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahul-digital.vercel.app"`.

> ⚠️ **Note the fallback is the Vercel URL, not the current domain.** Production canonicals are
> correct **only because `NEXT_PUBLIC_SITE_URL` is set to `https://adscaledigital.co` on Vercel.**
> If that var is ever missing/empty, the whole site silently canonicalises to
> `rahul-digital.vercel.app`. So this migration is fundamentally "set one env var correctly and
> redeploy" — but that also means **getting the env var right is load-bearing; don't leave it unset.**

### Hardcodes to flag (these do NOT follow the env var — update them by hand at cut-over)

| File:line | Hardcode | Action at migration |
|---|---|---|
| `lib/growth/knowledge.ts:11` | `BRAND.url = "https://adscaledigital.co"` | **Update to the new domain.** This is the growth agent's source-of-truth brand URL. |
| `lib/growth/attribution.ts:8` | `const SITE = BRAND.url…` | No edit — derives from `knowledge.ts:11`. Fixing the line above fixes every UTM link Scout writes. |
| `scripts/check-attribution-utm.ts:13` | asserts link `startsWith("https://adscaledigital.co/")` | **Update the assertion** to the new domain or the test fails after the `knowledge.ts` edit. |
| `scripts/check-attribution-utm.ts:19` | test input string uses `https://adscaledigital.co/app` | **Update** to the new domain. |
| `scripts/loadtest.mjs:16` | `BASE` default `https://adscaledigital.co` | Ops script default. Update (or always pass `BASE=` explicitly). Non-user-facing. |
| `scripts/smoke.mjs:9` | `BASE` default `https://rahul-digital.vercel.app` | Ops script default (old Vercel URL). Optional: bump to new domain. Non-user-facing. |
| `scripts/check-brand-consistency.ts:12-13,45` | comments + guard treat `adscaledigital.co` as an allowed domain | After moving to `adbrain.*`, the domain no longer contains the word "adscale", so the special-case allowance is moot. Update the comments; the `\badscale\b` ban itself needs no change. |

There is also a doc/marketing reference to the domain in `docs/growth/*.md`, `docs/*.md`,
`ARCHITECTURE.md`, `FEEDBACK-LEDGER.md`, `.env.local.example:33`, and blog copy
(`app/blog/page.tsx:4` is a comment). These are non-load-bearing; update opportunistically,
they do not affect the running app.

**Password-reset redirect:** `.env.local.example` documents `NEXT_PUBLIC_SITE_URL` as also used
for the "password-reset redirect". Confirm the Supabase Auth redirect/allow-list URLs are updated
to the new domain too (see Step 8) — the env var alone does not update Supabase's own config.

---

## Migration steps (in order)

### 1. Choose and buy the `adbrain.*` domain
- First choice `adbrain.com`; if taken, prefer a clean TLD that reads as the brand
  (`adbrain.ai`, `adbrain.co`, `getadbrain.com`, `adbrain.app`). Avoid another compound word
  that reintroduces a second brand token — the point is one clean entity = `AdBrain`.
- Buy it (any registrar, or Vercel Domains). Enable auto-renew and WHOIS privacy.
- **Do not touch DNS/Vercel yet.** Just own it.

### 2. Add the new domain to the Vercel project
- Vercel → project → **Settings → Domains → Add** → enter the apex (`adbrain.com`) and
  `www.adbrain.com`.
- Follow Vercel's DNS instructions at the registrar: apex `A`/`ALIAS` (or Vercel nameservers),
  `www` `CNAME` → `cname.vercel-dns.com`.
- Wait until Vercel shows the domain **Valid / SSL issued** (green). HTTPS must be live before
  it becomes primary.

### 3. Make the new domain the **primary** domain
- Vercel → Settings → Domains → on the new domain, set **"Set as Primary Domain."**
- Decide apex-vs-www once and keep it forever: pick `adbrain.com` as primary and let
  Vercel `308` `www` → apex (or vice-versa). Consistency matters more than which one.

### 4. Point the OLD domain + Vercel URL at the new one as **301 permanent redirects**
This is the SEO-preserving core. Every old URL must `301` to the **same path** on the new domain
(path-preserving, not a blanket redirect to the homepage — Google passes far more equity on a
path-to-path redirect).

- Keep `adscaledigital.co` **on the Vercel project** (do not remove it). In
  Settings → Domains, use Vercel's **"Redirect to…"** on `adscaledigital.co` → target
  `adbrain.com`, type **Permanent (308/301)**, path preserved.
- Do the same for `www.adscaledigital.co` if present.
- The `*.vercel.app` URL (`rahul-digital.vercel.app`) can't be "redirected" from the Domains UI
  the same way; add a path-preserving redirect in `next.config` (or `vercel.json`) keyed on the
  incoming `host` header so `rahul-digital.vercel.app/x` → `https://adbrain.com/x`. (This is a
  small code/config add only if you want the vercel.app URL to redirect; it is **not** required
  for the SEO of the real domain. If you skip it, at minimum keep it out of canonicals — which it
  already is, since canonicals follow `NEXT_PUBLIC_SITE_URL`.)
- **Verify:** `curl -sI https://adscaledigital.co/product` returns `301`/`308` with
  `location: https://adbrain.com/product`. Check a deep path and a blog post too.

### 5. Update `NEXT_PUBLIC_SITE_URL` (flips all canonicals/sitemap/robots/OG/JSON-LD)
- Vercel → Settings → Environment Variables → set
  `NEXT_PUBLIC_SITE_URL = https://adbrain.com` for **Production** (and Preview if you want
  previews self-consistent).
- **Redeploy** (env changes need a new build; `NEXT_PUBLIC_*` is inlined at build time).
- **Verify after deploy:**
  - `curl -s https://adbrain.com/robots.txt` → `Sitemap: https://adbrain.com/sitemap.xml`
  - `curl -s https://adbrain.com/sitemap.xml` → every `<loc>` on `adbrain.com`
  - View-source the homepage → `<link rel="canonical" href="https://adbrain.com/">`, OG `url`,
    and JSON-LD `Organization/WebSite/SoftwareApplication` `url` all on `adbrain.com`.
  - A blog post's canonical points at `https://adbrain.com/blog/<slug>`.

### 6. Update the code hardcodes + green the gates
Make these edits in one small PR (see the hardcode table above):
1. `lib/growth/knowledge.ts:11` → `url: "https://adbrain.com"`.
2. `scripts/check-attribution-utm.ts:13,19` → new domain in the assertion + test input.
3. (Optional) `scripts/loadtest.mjs:16`, `scripts/smoke.mjs:9` defaults → new domain.
4. (Optional) `scripts/check-brand-consistency.ts` comments (lines 12-13, 45) → drop the
   "adscaledigital.co is allowed" note; the `\badscale\b` ban stays.
- Run the gates: `node --experimental-strip-types scripts/check-attribution-utm.ts` and
  `scripts/check-brand-consistency.ts` must both pass. Then the full build.
- **Optional belt-and-suspenders:** bump the three SEO fallbacks
  (`app/layout.tsx:12`, `app/sitemap.ts:4`, `app/robots.ts:3`, `app/blog/[slug]/page.tsx:8`)
  from `"https://rahul-digital.vercel.app"` to `"https://adbrain.com"` so an unset env var can
  never silently canonicalise to the vercel.app URL. Low-risk, one-line each.

### 7. Google Search Console — the SEO-critical part
Do these **after** Steps 4-5 are live and verified (301s working + canonicals on the new domain).

1. **Add the new property.** GSC → Add property → **Domain** property `adbrain.com`
   (preferred; covers http/https + www + apex). Verify via the DNS `TXT` record at the registrar.
   (If you can't do DNS verification, add a **URL-prefix** property `https://adbrain.com` and
   verify by any supported method.)
2. **Submit the new sitemap.** New property → **Sitemaps** → submit `sitemap.xml`
   (full: `https://adbrain.com/sitemap.xml`).
3. **Use Change of Address.** Go to the **old** property (`adscaledigital.co` — it must still be
   a verified property in GSC; if it isn't, verify it first). **Settings → Change of Address**
   → select `adbrain.com` as the destination. GSC runs its checks (it confirms the sample `301`s
   resolve to the new domain) and then formally tells Google the site moved. This is what
   migrates ranking signals, not just the raw redirects.
   - Requirement: the old→new redirect must be a genuine `301`/`308` (Step 4), and both
     properties verified under the same account.
4. **Keep both properties in GSC** through the transition so you can watch old-domain impressions
   fall as new-domain impressions rise (expect a few weeks of overlap).
5. **Request (re)indexing** of the homepage + top pages on the new property via URL Inspection to
   nudge recrawl. Don't disallow the old domain in robots — Google must be able to crawl the old
   URLs to *see* the `301`s.

### 8. Update everything else that names the old domain
- **Supabase Auth:** update Site URL + Redirect/allow-list URLs to `https://adbrain.com`
  (password-reset + magic-link redirects). This is Supabase config, not the env var.
- **Meta / Google ad platform** OAuth redirect URIs and app domains (`META_REDIRECT_URI` etc.)
  → new domain, or logins break.
- Any OAuth consent screens, email-sender domains, DNS (SPF/DKIM if email is on the domain),
  analytics property, and external backlinks you control (social bios, LinkedIn, directories) →
  point at `adbrain.com`.

### 9. Keep the old `301`s in place for **years**, not weeks
- Do **not** let `adscaledigital.co` expire and do **not** remove the redirect after GSC shows the
  move complete. Backlinks and bookmarks on the old domain keep sending traffic and equity for a
  long time; the `301` is what forwards them. Treat the old domain as a permanent redirect asset
  (auto-renew on). Removing it later = re-losing the equity you just preserved.

---

## Verification checklist (run end-to-end after cut-over)
- [ ] `https://adbrain.com` loads over HTTPS, primary domain in Vercel.
- [ ] `curl -sI https://adscaledigital.co/product` → `301`/`308` → `https://adbrain.com/product` (path preserved).
- [ ] `curl -sI https://rahul-digital.vercel.app/` → redirects to `adbrain.com` (if Step 4 vercel.app redirect added).
- [ ] `robots.txt` + `sitemap.xml` + homepage canonical + OG + JSON-LD all say `adbrain.com`.
- [ ] Blog post canonical on `adbrain.com`.
- [ ] `scripts/check-attribution-utm.ts` + `scripts/check-brand-consistency.ts` pass; full build green.
- [ ] GSC: new Domain property verified, sitemap submitted, Change of Address submitted from old property.
- [ ] Supabase + Meta/Google OAuth redirect URIs updated; a real password-reset + ad-account connect tested live.

---

## Rollback
Because production canonicals are driven by one env var and the old domain is untouched, rollback is fast:
1. **Revert `NEXT_PUBLIC_SITE_URL`** back to `https://adscaledigital.co` on Vercel and redeploy —
   canonicals/sitemap/robots/OG/JSON-LD snap back immediately.
2. **Revert the primary domain** in Vercel → Domains back to `adscaledigital.co`, and remove/disable
   the `adscaledigital.co → adbrain.com` redirect so the old domain serves the app directly again.
3. **Revert the code PR** from Step 6 (`knowledge.ts` + test assertions) so `BRAND.url` and the UTM
   links point back at `adscaledigital.co`; re-run the gates.
4. **In GSC**, if you already submitted Change of Address, cancel it from the old property's Settings.
5. Leave `adbrain.com` parked on the project; retry the migration once the blocker is understood.

**Point of no easy return:** once Google has largely re-indexed on the new domain (weeks in), rolling
back means moving the entity *again* and re-incurring the same transition cost. Prefer fixing forward
after that point. Rollback is cheap only in the first hours/days while the `301`s and new canonicals are
still fresh.
