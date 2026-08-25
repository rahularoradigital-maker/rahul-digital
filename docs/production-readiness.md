# AdBrain — Production Readiness

**Posture:** this ships as a LIVE web product — real users, real Meta/Google account connections,
real ad-performance + revenue data (business-sensitive), and eventually money-moving write-back.
Not a demo, not a Claude artifact. Every design/build decision is made to production standards.
These gates are BLOCKING before real users touch it.

## 1. Security hardening (extends ADR-0002)
- [ ] OAuth `state` param (CSRF protection) on the Meta/Google connect flow; verify on callback.
- [ ] Rate limiting on auth + API routes (Supabase has some; add app-level for the cron/ingest routes).
- [ ] Input validation at every trust boundary (form data, OAuth params, API responses parsed before use).
- [ ] Secrets ONLY in Vercel server env; never `NEXT_PUBLIC_*`; never logged. Token master key rotatable.
- [ ] Security headers / CSP on the app; HTTPS only.
- [ ] Dependency/supply-chain: pin + audit (`npm audit` in CI); no unmaintained deps.
- [ ] The audit-F4 rule enforced: no token/secret ever returned to the client.

## 2. Privacy & legal (NEW — not in the 28-artifact plan; add as artifact [29])
- [ ] **Privacy Policy + Terms of Service** pages (the marketing footer already lists them as stubs).
- [ ] **Meta Platform Terms + Developer Policies** compliance: data used only for the connecting
  user's own analysis; documented data use; app review before public launch; honor data-deletion callbacks.
- [ ] **Google API Services User Data Policy** compliance (when Google connects): limited use, disclosure.
- [ ] **Data retention + deletion:** user can disconnect an account and delete their data; define retention windows.
- [ ] **GDPR/CCPA basics:** lawful basis, data-subject requests, a data-processing addendum for agencies.
- [ ] **PII handling:** ad data + user emails are sensitive; minimize, encrypt sensitive fields, restrict access.
- [ ] Cookie/consent handling on the marketing site (privacy-preserving defaults).

## 3. Reliability & observability (NEW — add as artifact [30]; partly in tech-debt #2)
- [ ] Error tracking (e.g. Sentry) on client + server; alert on spikes.
- [ ] Structured logging with NO tokens/PII; request tracing for the ingest pipeline.
- [ ] Product/ops metrics: job success/failure, Validator `cannot_verify` rate, sync failures,
  Gemini/ScrapeCreators quota alarms (the free-tier breaking points from system-design).
- [ ] Uptime monitoring + a status expectation; Supabase auto-pause mitigated (keep-alive).
- [ ] Backups: Supabase point-in-time / export; test a restore.

## 4. Deployment
- [ ] Custom domain + HTTPS; env managed in Vercel (prod vs preview separated).
- [ ] Staging/preview environment distinct from prod; migrations run deliberately (not auto on deploy).
- [ ] Rollback drill (Vercel instant rollback) actually tested once.
- [ ] The Phase-0 and (later) Phase-1 deploy checklists gate each release.

## 5. Cost & scale (from system-design)
- [ ] Budget ~$20-70/mo at ~10-20 users (Vercel Pro for cron granularity, ScrapeCreators, maybe paid Gemini).
- [ ] The single shared Gemini key → per-tenant keys / paid tier before contention hits (~20 users).

## Changes to the master plan
Add two artifacts to the 28: **[29] Legal / Privacy / Compliance** and **[30] Production Ops &
Observability**. Fold these into the QA phase. (Master-plan file updated after the running Phase 2
workflow completes, to avoid editing a file its agents are reading.)

## The standard
"Would I connect my own company's live Meta ad account and revenue data to this?" If not, it is not
ready for someone else's.
