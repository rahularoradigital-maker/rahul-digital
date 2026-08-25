# Intended vs. Implemented Audit — 2026-08-25

Method: compare documented intent (DECISIONS.md, ADR-0002, cockpit spec, DESIGN.md,
agent-roles) against implemented code, citing file:line. AdBrain is pre-build: most intent
is not yet implemented, which is expected, not a vulnerability. Findings are classified as
**(S)ecurity boundary**, **(D)rift** (docs vs code disagree), or **(U)nbuilt** (intent with
no code yet — ranked by exposure once built).

## Verified boundaries that HOLD (evidence cited)

- **Secrets are server-only.** `NEXT_PUBLIC_*` carries only the Supabase URL + anon key
  (`lib/supabase/client.ts:6-7`, `server.ts:12-13`, `proxy.ts:18-19`) — both intended to be
  public. The service-role key, `ANTHROPIC_API_KEY`, and `TOKEN_ENC_KEY` appear only in server
  modules (`lib/anthropic.ts:9-13`, `lib/crypto.ts:12-16`). Matches D13 / ADR-0002. ✓
- **`oauth_tokens` is deny-by-default.** RLS enabled with no policy
  (`supabase/migrations/0002_ad_accounts.sql:35,42`) → clients get zero rows; only the service
  role can read. Matches ADR-0002. ✓
- **Own-data RLS.** `0001_init.sql` scopes every table to `auth.uid()` via `user_id`/brand
  ownership; `ad_accounts` owner policy at `0002:38-39`. ✓
- **/app is gated twice:** `proxy.ts` verifies the user with `getUser()` (server-verified, not
  just a cookie) and redirects if absent; `app/app/layout.tsx:9` also guards. ✓
- **Client surface is minimal:** only `components/auth-form.tsx` is `"use client"`, and it
  imports a type + server actions, no server-only lib. ✓

## Findings

### F1 (D) — Docs say Gemini; code is still Claude. MATTERS (correctness/consistency).
- **Intent:** DECISIONS.md D6 and the cockpit spec: "AI = all-Google Gemini; Claude dropped."
- **Reality:** the only AI code is Claude (`lib/anthropic.ts`, `app/api/health/claude/route.ts`);
  `grep gemini` in code returns nothing. User-facing copy still says Claude
  (`app/app/page.tsx` dashboard empty-state).
- **Who's affected:** no attacker/victim — this is not a security gap. It's intent drift: the
  docs now contradict the code, which weakens every future audit.
- **Fix:** either (a) do the Phase 1 provider swap (add `lib/gemini.ts` + health route, retire
  Claude), or (b) if Claude stays for Phase 0, note that explicitly in D6 so docs and code agree.
- **Status:** scheduled (spec §9 plans the swap), but currently unreconciled.

### F2 (D) — Docs say warm-paper design; code is still indigo/dark. Non-security.
- **Intent:** DESIGN.md: "REPLACES the Phase 0 indigo-on-dark look."
- **Reality:** `app/globals.css` + components still ship the indigo/dark tokens.
- **Fix:** the scheduled DESIGN.md re-base (cockpit spec build step 3). Until then, DESIGN.md
  describes a look the app does not have. Flag so it is not mistaken for done.

### F3 (D) — SETUP.md matches code, not the Gemini decision.
- **Intent vs intent:** SETUP.md tells the owner to get `ANTHROPIC_API_KEY` / run `check:claude`.
  That matches the CODE but contradicts D6 (Gemini). Two docs disagree.
- **Fix:** reconcile when F1 is resolved; add `GOOGLE_API_KEY`/`check:gemini` to SETUP at the swap.

### F4 (U) — Token write path + "no token to client" check not implemented. Rank: HIGH once built.
- **Intent:** ADR-0002 action items 2-8: encrypt before store, service-role-only reads, never log
  or return a token to the client.
- **Reality:** `lib/crypto.ts` exists and is tested, but nothing calls it; no service-role client
  exists (`SUPABASE_SERVICE_ROLE_KEY` is unused in code); action item #8 (review/lint check that no
  token reaches the client) is not in place.
- **Exposure now:** none — no tokens are stored yet.
- **Must enforce when OAuth ships:** encrypt-on-write, service-role-only read, and the no-token-to-
  client check. This is the highest-stakes future boundary.

### F5 (U) — "Never auto-apply to a live account" (D12) has no enforcement point yet. Rank: HIGH once built.
- **Intent:** D12 / principle #6 / cockpit spec §7: recommendations stage only; Apply needs an
  explicit confirm; no auto-apply.
- **Reality:** no write-back code exists, so nothing violates it — and nothing enforces it.
- **Must enforce when built:** the typed-confirm gate + audit log described in the interaction spec.

### F6 (U) — Cockpit data-model tables (recommendations, ad_metrics, changes, jobs) not created.
- **Intent:** cockpit spec §8 + agent-roles (RLS-scoped).
- **Reality:** only `ad_accounts` + `oauth_tokens` exist (migration 0002). The rest is unbuilt.
- **Exposure now:** none. **When built:** each new table needs the same owner-RLS as 0001, or it
  becomes a tenant-isolation gap. Note this in the migration that adds them.

## Summary
- **Security posture today: sound.** Every implemented boundary (secrets, token table, RLS, auth
  gate) matches its documented intent.
- **Real drift to fix: F1-F3** — the docs claim Gemini + warm-paper, the code is Claude + indigo.
  Not security, but the docs currently lie about the code, which is exactly what erodes future audits.
  Cheapest fix: do the provider swap + design re-base (both already scheduled), then reconcile SETUP.
- **F4-F6 are not vulnerabilities yet** because the code doesn't exist; they are "enforce-when-built"
  contracts to carry into the OAuth and cockpit work.
- **No fabricated intent:** where docs are silent (e.g., rate-limit specifics), this audit says so
  rather than inventing a gap.
