# Migrations — status (ISSUE 12)

Schema changes are applied via the Supabase MCP `apply_migration`, which records them in the remote
`supabase_migrations` history. This directory mirrors them as SQL for review and version control.

## Known gap (ISSUE 12 — not yet fully closed)

`0001_init.sql` / `0002_ad_accounts.sql` describe an **earlier** shape of some tables (e.g. the old
`competitor_ads` with `brand_id`/`external_ad_id`) that does **not** match the production tables the
app actually uses (`competitor_ads` keyed by `user_id, account_external_id, page_id, ad_archive_id`,
plus `ask_log`, `demo_requests`, `cockpit_cache`, `brand_profiles`, `creative_insights`,
`competitor_creative_analysis`, `decision_triples`). Those production tables were created out-of-band
in earlier sessions and are **not** reconstructable from the files here.

Therefore a clean database **cannot** yet be rebuilt from `0001` onward alone.

## To close ISSUE 12 fully (requires DB credentials — a Rahul action)

1. `supabase link` this repo to project `gizgdgyxyqpvtgecrmik`.
2. `supabase db pull` to generate a single accurate **baseline** migration from the live schema
   (tables, columns, constraints, indexes, RLS policies, functions).
3. Replace `0001`/`0002` with that baseline; keep `0003`+ (this session's changes) on top.
4. Add a CI job that runs every migration from an empty database and asserts every table the code
   references exists — so "no schema change without a migration" is enforced, not just intended.

`0003`–`0005` in this directory are this session's changes, already applied to production.
