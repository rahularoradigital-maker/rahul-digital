# ADR-0002: Ad-account connection, OAuth token security, and sync

**Status:** Proposed
**Date:** 2026-08-25
**Deciders:** Rahul (owner), Claude (implementer)

## Context

The repointed Phase 1 (own-account action cockpit) makes "connect your ad account, then
pull data" the first user action. That requires OAuth to Meta (primary) and Google
(secondary), storing each user's access + refresh tokens, and syncing ad performance on a
schedule. These tokens are the highest-risk asset in the product: a leaked token lets an
attacker read the account and, once write-back exists, spend or move the user's money.

Forces:
- **Security is the top non-functional requirement** (payment-adjacent secrets).
- **Non-technical owner, low-ops, managed stack** (Next.js + Supabase + Vercel, free-first).
- **Few first users, low concurrency**; Meta runs under dev/standard access (users as testers).
- Connection is interactive (OAuth redirect); sync is background (not latency-sensitive).

## Decision

1. **Server-side OAuth Authorization Code flow** (PKCE where supported), handled entirely in
   Next route handlers. The browser never sees the client secret or any token. Redirect URIs
   are registered per environment (localhost + the production domain).
2. **Token storage: app-layer envelope encryption in a service-role-only Postgres table.**
   Each token is encrypted with AES-256-GCM using a master key held only in Vercel server env
   (`TOKEN_ENC_KEY`). `ad_accounts.token_ref` points to the encrypted row; RLS denies all
   client access; only server code with the service role decrypts. Tokens are never in a
   `NEXT_PUBLIC_*` var, never logged, never returned to the browser.
3. **Sync: Vercel Cron (nightly) + debounced on-demand refresh**, writing through a `jobs` row.
   Pull incrementally by date since `last_synced_at`; upsert `ad_metrics` on `(ad_id, date)`.
   No full re-pull per view.
4. **Provider abstraction `AdSource`** (list ads, fetch metrics, refresh token) so Meta and
   Google share one interface and the cockpit stays source-agnostic.
5. **Meta access:** dev/standard access with first users added as testers; begin public app
   review in parallel. Google Ads API developer-token approval is gated and may lag (Google
   lands late without touching the UI, thanks to the abstraction).

## Options Considered (token storage)

### Option A: App-layer envelope encryption in Postgres (CHOSEN)
AES-256-GCM per token, master key in Vercel env, service-role-only table, RLS locked.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium (own the encrypt/decrypt helper + key rotation) |
| Cost | Free (in existing Supabase) |
| Scalability | Good (per-row, scales with users) |
| Team familiarity | High (plain Node crypto, standard pattern for user OAuth tokens) |

**Pros:** standard pattern for storing many per-user tokens; stays in-stack and free; full
control over access path; easy to reason about (one table, one key).
**Cons:** we own the crypto helper and key rotation; a leaked `TOKEN_ENC_KEY` is catastrophic,
so it must live only in server env and be rotatable.

### Option B: Supabase Vault
Store tokens via Supabase's managed secrets encryption (pgsodium-backed), read through a
decrypting view.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium (managed encryption, but an unusual fit for many per-user rows) |
| Cost | Free (in Supabase) |
| Scalability | Medium (Vault is designed for a handful of app secrets, not thousands of user tokens) |
| Team familiarity | Low-medium |

**Pros:** no custom crypto; encryption at rest managed by Supabase.
**Cons:** Vault targets app-wide secrets, not per-user token rows; the access pattern (views)
is awkward for frequent server refresh; less standard for this use case.

### Option C: External secrets manager (AWS Secrets Manager / Infisical / Doppler)
Dedicated secrets vendor.

| Dimension | Assessment |
|-----------|------------|
| Complexity | High (new vendor, SDK, IAM/auth) |
| Cost | Paid beyond small tiers |
| Scalability | Excellent |
| Team familiarity | Low |

**Pros:** best-in-class security, rotation, audit.
**Cons:** a second vendor + ops + bill; contradicts low-ops/free-first; overkill for a handful
of first users.

## Trade-off Analysis

The real tension is **security rigor vs low-ops/free**. Option C is the most robust but adds a
vendor and cost the MVP does not justify. Option B avoids custom crypto but Vault is the wrong
shape for thousands of per-user tokens and makes the frequent server-side refresh awkward.
Option A is the standard, well-understood pattern for storing user OAuth tokens: it stays in
the existing stack, costs nothing, scales per-user, and keeps the access path simple and
auditable. Its one real risk (owning the master key) is managed by keeping `TOKEN_ENC_KEY`
server-only and rotatable, and by locking the table to the service role via RLS.

## Consequences

- **Easier:** one stack (Supabase) for data + tokens; free; the `AdSource` abstraction lets
  Google land late; sync is a simple cron + jobs pattern.
- **Harder:** we own an encrypt/decrypt helper and a key-rotation procedure; the master key
  becomes a critical operational secret; a token refresh path must handle expiry/rotation.
- **Revisit when:** user count or compliance needs grow (then move to Option C), or if
  write-back is enabled (tighten to per-action confirms + audit, per ADR/spec §7).

## Action Items

1. [ ] Add `TOKEN_ENC_KEY` to server env (Vercel + `.env.local`); document in SETUP.
2. [ ] Build `lib/crypto.ts` (AES-256-GCM encrypt/decrypt) with a runnable round-trip check.
3. [ ] `ad_accounts` + a service-role-only `oauth_tokens` table; RLS denies client reads.
4. [ ] Meta OAuth route handlers (authorize + callback), server-side, PKCE where supported.
5. [ ] `AdSource` interface + Meta implementation (list ads, fetch metrics, refresh token).
6. [ ] Vercel Cron + `jobs`-driven incremental sync; upsert `ad_metrics` on `(ad_id, date)`.
7. [ ] Register redirect URIs for localhost + production; add users as Meta app testers.
8. [ ] Never log tokens; add a lint/review check that no token field is returned to the client.
