// Account-deletion MANIFEST - the single source of truth for what happens to every user-owned table when a
// user deletes their account. This file is DATA ONLY: it classifies tables, it does not delete anything. The
// executor (built next, behind a confirm dialog + throwaway-account test) reads these lists so coverage is
// correct-by-construction, and `scripts/check-account-deletion.ts` fails CI if any user_id-scoped table in the
// migrations is missing here - which is exactly how we prevent the orphan bug (many user tables are user_id-
// scoped WITHOUT an auth.users FK cascade, so a naive "delete the auth user" would leave them behind).
//
// Rahul's decisions (2026-09-01): soft-delete + 14-day grace before purge; sole-owner org + its brands/data
// are deleted; the Meta token is REVOKED at Meta on delete; audit_log is RETAINED anonymized (default - flag
// to override).

export const GRACE_PERIOD_DAYS = 14; // soft-delete: revoke access now, purge after this many days; re-login cancels
export const REVOKE_META_ON_DELETE = true; // call Meta to revoke the OAuth token, not just delete our copy

// SET A - removed automatically by `on delete cascade` from auth.users when the auth user is deleted (last).
// Listed so the coverage check knows they ARE handled (by cascade), and to document the blast radius.
export const CASCADE_FROM_AUTH_USER = [
  "ad_accounts", "ai_usage", "brand_members", "brands", "creative_semantics",
  "notifications", "org_members", "orgs", "profiles", "token_usage",
  "account_deletions", // soft-delete tracking (0042): FK to auth.users on delete cascade - removed with the user
] as const;

// SET B - user_id-scoped but NO auth.users FK cascade: the executor MUST delete these explicitly by user_id
// (in FK-safe order, resumable batches for the large ones). oauth_tokens is revoked at Meta FIRST, then deleted.
export const EXPLICIT_DELETE_BY_USER = [
  "ad_metrics", "ad_meta", "ad_sync_state", "ad_changes", "change_sync_state",
  "influencer_creator", "influencer_audience_snapshot", "influencer_contact", "influencer_memory",
  "influencer_search", "influencer_search_result", "influencer_shortlist", "influencer_sync_state",
  "shopify_connections", "shopify_products", "shopify_sync_state",
  "cockpit_cache",
  "account_rollups", "creative_rollups", "account_verifications", // instant-app precompute + self-proving trend (0035-0037): user_id-scoped derived data, delete on account removal
  "deep_analysis_run", "deep_creative_read", // deep creative analysis (0028): user_id-scoped derived reads, delete on account removal
  "creative_patterns", "opportunities", // creative-intelligence schema (0038): user_id-scoped (verified: user_id, no auth-user cascade), delete on account removal
  "jobs", // durable job queue (0027): delete the user's queued work on deletion. user_id is nullable -
          // deleting by user_id removes their jobs and leaves system jobs (null user_id) untouched.
  "web_vitals", // RUM telemetry (0041): user_id-scoped (nullable), no auth-user cascade. Delete the user's
                // rows on removal; anonymous-beacon rows (null user_id) are untied to anyone and stay.
] as const;
// Notes on tables handled by CASCADE (not user_id-scoped, so not listed above), transitively removed with
// their parent when the auth user is deleted:
//  - test_plans / test_plan_items -> cascade via brand_id -> brands -> auth.users.
//  - oauth_tokens -> cascade via ad_account_id -> ad_accounts -> auth.users. BUT it must be READ and the Meta
//    token REVOKED (EXTERNAL_REVOCATIONS) BEFORE the auth-user delete cascades it away.
//  - competitors / competitor_ads / triples -> cascade via brand_id -> brands.
//  - org_invites -> cascade via org_id -> orgs.

// SET C - deliberately RETAINED or ANONYMIZED (never hard-deleted with the user).
export const RETAIN_OR_ANONYMIZE: { table: string; how: string }[] = [
  { table: "owner_events", how: "on delete set null by design - anonymized aggregate history stays" },
  { table: "audit_log", how: "retained; actor_id anonymized (security/compliance trail). Override to hard-delete." },
];

// Every user_id-scoped table must be in exactly one bucket. The check derives the migration set and diffs it.
export const CLASSIFIED_TABLES: ReadonlySet<string> = new Set<string>([
  ...CASCADE_FROM_AUTH_USER,
  ...EXPLICIT_DELETE_BY_USER,
  ...RETAIN_OR_ANONYMIZE.map((r) => r.table),
]);

// External revocations the executor performs BEFORE deleting the local rows (best-effort, logged, never
// silently skipped - a failure downgrades to "revoke pending").
export const EXTERNAL_REVOCATIONS = [
  { provider: "meta", what: "revoke the OAuth token/permissions at Meta (Platform data-deletion)", table: "oauth_tokens" },
  { provider: "shopify", what: "revoke/uninstall the app where applicable", table: "shopify_connections" },
] as const;
