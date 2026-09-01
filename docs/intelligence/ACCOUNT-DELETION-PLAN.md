# Account Deletion — Plan for approval (charter Phase 8, GATED)

Status: PLAN ONLY. No deletion code is built or run until Rahul approves. Deletion is destructive and a
legal/Meta-Platform requirement, so it goes through the gate: map all user-owned data, classify
delete/retain/anonymize/revoke, design an auditable + idempotent workflow with explicit confirmation.

## 1. Data map (from the 24 migrations) — every store that holds user data

**A. Auto-deleted by `on delete cascade` from `auth.users` (removed when the auth user is deleted):**
brands (→ competitors, competitor_ads, triples via brand cascade), ad_accounts, org_members, notifications,
creative_semantics, ai_usage, token_usage, profiles. (Verify each FK before relying on it.)

**B. `user_id`-scoped but NO FK cascade → MUST be deleted explicitly by user_id (else orphaned):**
ad_metrics, ad_meta, ad_sync_state, ad_changes, change_sync_state, influencer_creator,
influencer_audience_snapshot (+ any other influencer_* / search tables), shopify_connections,
shopify_products, shopify_sync_state, cockpit_cache, growth_briefs / growth_drafts / growth_articles /
growth_sources (confirm their scoping), oauth_tokens (see D — revoke first). This is the critical set the
naive "delete the auth user" approach would LEAVE BEHIND.

**C. Deliberately RETAINED / ANONYMIZED (do NOT hard-delete):**
- `audit_log` (actor_id, no FK) — retain for security/compliance; anonymize actor_id → null or a tombstone.
- `owner_events` (`on delete set null` by design) — anonymized aggregate history stays.
- `org_invites.invited_by`, `provider_keys.updated_by`, `profiles.approved_by` — `set null` on delete.
- Orgs the user solely owns: decide (delete the org + its brands, or reassign) — see decision Q3.

**D. External revocations (before deleting the local rows):**
- **Meta OAuth token** (`oauth_tokens`, AES-GCM): call Meta's token/permission revocation so AdScale's
  access ends at Meta, then delete the row. This is the Meta Platform data-deletion obligation.
- Shopify connection: revoke/uninstall where applicable, then delete `shopify_connections`.

**E. Stored FILES (VERIFY before building):** generated creative images / exports — confirm whether they
live in Supabase Storage / a blob bucket keyed by user, and delete those too. (Not yet confirmed from the
schema — an explicit check is the first build step.)

## 2. Proposed workflow (auditable, idempotent, confirmed)
1. **Confirm:** a real confirmation UI in Settings — user types their email (or "DELETE") + a warning of
   exactly what is removed and what is retained (audit trail). No one-click delete.
2. **Grace period (decision Q1):** either immediate hard-delete, or a soft-delete (mark `deletion_requested_at`,
   revoke access now, purge after N days, cancel on re-login). Soft is safer + reversible before final purge.
3. **Revoke external** (Meta token, Shopify) — best-effort, logged; a failure downgrades to "revoke pending",
   never silently skipped.
4. **Delete set B explicitly** (by user_id), in FK-safe order, in a transaction / resumable batches for large
   accounts (ad_metrics can be large — same resumable discipline as sync).
5. **Anonymize set C** (audit_log actor, etc.).
6. **Delete the auth user last** → cascades set A.
7. **Write ONE final audit_log entry** (deletion completed, counts per table) BEFORE the actor row is gone,
   with a system actor. Idempotent: re-running finds nothing left and is a no-op.

## 3. Decisions I need from you (gated)
- **Q1 — Immediate hard-delete, or a soft-delete + N-day grace period then purge?** (Grace is the safer default.)
- **Q2 — Legal retention:** anything you must keep for law/finance (e.g. billing records once payment exists)?
  For now there are no billing records; audit_log is retained anonymized. Confirm that's acceptable.
- **Q3 — Sole-owner orgs/brands:** if the user is the only member of an org, delete the org + its brands +
  all that brand's data, correct? (Agency members who share an org are only removed from membership.)
- **Q4 — Meta revocation:** confirm we should call Meta to revoke the token on deletion (Platform-compliant),
  not just delete our copy.

## 4. Verification plan (before it can be called done)
- A `check-account-deletion.ts` that asserts every set-B table is covered (fails if a new user-scoped table
  is added without being included — prevents future orphans).
- A dry-run "what would be deleted" count per table shown in the confirm dialog.
- Live test on a THROWAWAY account (never a real one): request deletion → verify every table is empty for
  that user_id, the Meta token is revoked, audit_log has the tombstone, and re-running is a no-op.
- Idempotency + partial-failure (external revoke fails) tested explicitly.

## Out of scope until approved
No schema migration, no deletion endpoint, no UI — this document is the plan. On approval I build it behind a
confirm dialog, live-test on a throwaway account only, and never run it against a real account.
