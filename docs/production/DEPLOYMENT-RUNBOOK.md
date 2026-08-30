# AdBrain — Deployment & Ops Runbook

> Live: **https://www.adscaledigital.co** · Vercel project **rahul-digital** · Repo **rahularoradigital-maker/rahul-digital**
> Last updated: 2026-08-30.

## Deploy

Production deploys from the **`validation-v0-v1`** branch (this repo has **no `main`**; `origin/HEAD → validation-v0-v1`). Vercel auto-builds on every push.

```bash
# from /Users/lyxelflamingo/adbrain-mvp, on validation-v0-v1
npm run typecheck && npm run build && npm run check:all   # gate must be green
git push origin validation-v0-v1                          # triggers the production build
```

Verify the deploy landed:
```bash
curl -s https://www.adscaledigital.co/api/health
```
Healthy looks like: `{"status":"ok","db":"up","cronConfigured":true,"providers":{...},"sync":{"withErrors":0,...}}` (HTTP 200). `503`/`"degraded"` means something is off (db down, a sync error, or cron unset).

## Rollback

Vercel keeps every deployment. To roll back: **Vercel → rahul-digital → Deployments → pick the last-good build → Promote to Production.** (Instant, no rebuild.) Or `git revert <sha> && git push`.

## Domain / DNS (GoDaddy: adscaledigital.co)

- `A  @   → 216.198.79.1` (Vercel; legacy `76.76.21.21` also works)
- `CNAME www → 44a4c8c172cb506f.vercel-dns-017.com`
- Apex 308-redirects to `www` (canonical). Forwarding is OFF (it overrides the A record — keep it off).

## Environment variables (Vercel → Settings → Environment Variables)

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENC_KEY`, `GEMINI_API_KEY`, `META_APP_ID/SECRET/REDIRECT_URI`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL=https://www.adscaledigital.co`.
Fallback AI (set): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`.
Optional: `SCRAPECREATORS_API_KEY`; `IMAGE_PROVIDER` (see below); `INFLUENCER_HUNT_ENABLED`, `ADBRAIN_PERF`.
Full list + notes: `.env.local.example`. Env changes only apply to the **next** deploy.

## AI model routing (lib/ai)

Per-task routing with cross-provider fallback lives in `lib/ai/config.ts` (light→Gemini flash-lite; standard→Gemini flash→Claude Sonnet; vision-volume→Gemini flash→GPT-mini-vision; heavy→Claude Sonnet→GPT-top→Gemini). Keyless-graceful: a provider is skipped if its key is absent. Override any task: `AI_PROVIDER_<TASK>` / `AI_MODEL_<TASK>`. Gate: `npm run check:ai`.

## Real ad-image generation (currently OFF)

`/api/health` shows `imageProvider`. If `null`, the app serves **stub placeholder** creatives. To turn on real images set **`IMAGE_PROVIDER=google`** (Nano Banana, uses `GEMINI_API_KEY`) or **`IMAGE_PROVIDER=openai`** (GPT-Image, uses `OPENAI_API_KEY`), then redeploy. `realImages:true` confirms it's live.

## Background sync (cron)

`vercel.json` runs the daily cron → `/api/cron/sync` (auth: `Bearer $CRON_SECRET`). It self-chains to converge large accounts. Failures now surface to the user's Notification Center and to `/api/health` (`sync.withErrors`).

## Health & monitoring

- Liveness/data-health: `GET /api/health` (public, aggregate counts only). Point an uptime monitor here.
- Per-user activity + failures: the in-app Notification Center (bell).
- Server errors: captured centrally via `instrumentation.ts onRequestError` → `lib/observability.ts` (swap to Sentry by adding a DSN there).
- Build/data health in CI: `.github/workflows/engineering-health.yml` (daily) + `npm run health`.

## Load test

`npm run loadtest` (bounded, public-GET-only). Point at a preview for real scale: `BASE=<preview-url> COUNT=500 CONCURRENCY=25 npm run loadtest`. Do NOT run heavy load against production.

## Known follow-ups (need a person)

Resend SMTP + Supabase Auth URL config (reset emails); Sentry DSN; `IMAGE_PROVIDER`; backup restore drill; Upstash (distributed rate limiting); cost-alarm channel; confirm `docs/AdBrain-API-Keys-List.xlsx` in the repo holds no real secrets.
