# AdBrain — Backup & Restore Drill

> Goal: prove we can actually recover the database, not just that backups exist. "We have backups" is not
> done until a restore has been run once. Do this drill once before launch, then quarterly.
> Supabase project id: `gizgdgyxyqpvtgecrmik`.

## 1. Confirm backups are on (2 min)

**Supabase → Project → Settings → Database → Backups.**
- **Free/Pro daily backups:** listed here (daily snapshots, ~7-day retention on Pro).
- **Point-in-Time Recovery (PITR):** a paid add-on that lets you restore to any second. Confirm whether it's enabled. For a real product, PITR is strongly recommended (RPO ~ minutes vs up to 24h with daily-only).

Record: backup type (daily / PITR), retention window, and the **RPO** (max data you could lose) and **RTO** (how long recovery takes) you're accepting.

## 2. Non-destructive restore drill (the real test) (20-30 min)

**Never restore over production.** Restore into a *separate* project and point a local app at it.

1. **Create a scratch project:** Supabase → New Project (same region), name it `adbrain-restore-drill`.
2. **Get the data in.** Two options:
   - **PITR/backup clone** (if your plan supports project-to-project restore): Settings → Database → Backups → Restore, targeting the scratch project.
   - **Portable dump (works on any plan):** from a machine with `pg_dump`/`psql` and the production DB connection string (Settings → Database → Connection string):
     ```bash
     # Dump production (read-only operation)
     pg_dump "$PROD_DB_URL" --no-owner --no-privileges -Fc -f adbrain-prod.dump
     # Restore into the scratch project
     pg_restore --no-owner --no-privileges -d "$SCRATCH_DB_URL" adbrain-prod.dump
     ```
3. **Boot the app against the restored DB.** In a local `.env.local`, set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to the **scratch** project's values (keep
   the other keys), then `npm run dev`.
4. **Verify integrity:** sign in (a test user), open the cockpit, confirm ad_metrics / ad_meta counts look
   right, and hit `/api/health` (db up, sync counts present). Spot-check a few tables in the scratch project's
   SQL editor: `select count(*) from ad_metrics;`, `select count(*) from notifications;`.

## 3. Record the result

Write down: date run, method used, row-count spot-checks matched (yes/no), time taken (your real RTO), and
any surprises. Then **delete the scratch project** so it doesn't accrue cost.

## 4. What to fix if the drill fails

- Restore missing recent data → daily-only backups; enable **PITR** to shrink RPO.
- Restore slow → note the real RTO; if too slow for the business, upgrade the plan or pre-stage a warm replica.
- App won't boot on the restore → a migration or extension isn't captured; ensure all `supabase/migrations`
  are applied to the scratch project (`supabase db push` against it) before pointing the app at it.

## Disaster-recovery quick reference

| Failure | First move |
|---|---|
| Bad data / accidental delete | PITR restore to the second before it, into a scratch project, then cut over. |
| Supabase project down | Check Supabase status; restore latest backup into a new project; repoint the app's 3 Supabase env vars in Vercel + redeploy. |
| Credential compromised | Rotate `SUPABASE_SERVICE_ROLE_KEY` + `TOKEN_ENC_KEY` (note: rotating TOKEN_ENC_KEY invalidates stored OAuth tokens - users reconnect Meta). |
| Vercel down | Vercel is multi-region; if a deploy is bad, Instant Rollback (Deployments → Promote last-good). |
