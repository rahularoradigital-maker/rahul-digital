# AdBrain Private-Beta Access-Control Plan

**Status:** DESIGN ONLY. No enforcement changed, nothing deployed, no migration run by this document.
**Author:** Principal Security audit, 2026-09-01.
**Scope:** Add a private-beta access gate so a self-signed-up user is *authenticated but not entitled* until an admin approves them, without locking out any of today's working users and without weakening existing tenancy isolation.

This plan is executable without re-auditing: every file path, table, and column below was read from the live repo.

---

## 0. TL;DR of the current hole

`app/(auth)/actions.ts › signup()` calls `supabase.auth.signUp()` with **no allowlist**. The proxy (`proxy.ts`) treats `/login` and `/signup` as public, and gates `/app` on *session only*. `lib/app/user.ts › getCurrentUser()` and `app/app/layout.tsx` also check *only "is there a session"*. Therefore **anyone on the internet can register and immediately reach every `/app` screen and every expensive API** (Meta sync, Gemini, ScrapeCreators, creative generation). There is no `profiles`/`entitlement`/`plan`/`subscription`/`waitlist` concept anywhere in the schema. Admin is the only differentiated tier and it is an env allowlist (`lib/admin.ts › isAdminEmail`, default `digitalwave27@gmail.com`).

The fix: introduce one **access-state** anchor per user, default new users to `WAITLIST`, backfill all existing real users to `APPROVED`, and add a single cheap fail-closed gate enforced in three layers (middleware, per-API, RLS-as-defense-in-depth).

---

## 1. Current auth & authorization map (as-built)

### 1.1 Session / navigation gate
| Layer | File | What it does | Gap for private beta |
|---|---|---|---|
| Proxy (Next 16 renamed middleware → `proxy`) | `proxy.ts` | On `/app*` only: `createServerClient` + `auth.getClaims()` (local ES256 verify, refreshes cookie). No session → redirect `/login?next=`. Fails open to "unauthenticated → login" on any error. | Only checks *session exists*, not *entitled*. |
| Segment layout guard | `app/app/layout.tsx` | `getCurrentUser()`; `!user` → `redirect("/login")`. Renders the whole app shell otherwise. | Same: session-only. This is the natural place to add the product-access gate for navigation. |
| Request-deduped user | `lib/app/user.ts › getCurrentUser()` | `cache()`-wrapped `auth.getClaims()`, returns `{id, email?}` or `null`. Never throws. | Returns identity only; no access-state. |
| Signup | `app/(auth)/actions.ts › signup()` | Open `supabase.auth.signUp()`. If email-confirm off → session immediately → `redirect("/app")`. | **Open registration = the core hole.** |
| Login / logout / reset | `app/(auth)/actions.ts`, `app/auth/callback/route.ts` | Standard Supabase password + magic-link callback. `app/api/admin/invite` already uses `auth.admin.inviteUserByEmail`. | Invite path already exists — reuse it. |

### 1.2 Supabase clients
- `lib/supabase/server.ts › createClient()` — anon key, cookie-bound. Subject to RLS. Used in Server Components / route handlers for `auth.getUser()/getClaims()`.
- `lib/supabase/client.ts` — browser anon client.
- `lib/supabase/admin.ts › createAdminClient()` — **service-role, bypasses RLS**, `server-only`. **This is what almost every feature read/write actually uses** (see `lib/tenancy/resolve.ts`, `lib/notifications/store.ts`, `lib/*/store.ts`). Consequence: **RLS is defense-in-depth, not the primary gate** — the primary gate must be app-layer.

### 1.3 Authorization primitives that already exist (reuse, don't rebuild)
| Concern | File | State |
|---|---|---|
| Admin allowlist | `lib/admin.ts › isAdminEmail(email)` | Env `ADMIN_EMAILS` (comma list, default founder). Used by `app/app/admin/page.tsx`, `app/api/admin/invite`, `app/api/admin/keys`. |
| Tenant roles | `lib/tenancy/access.ts` (`OrgRole` = owner/admin/member/viewer), `resolve.ts › resolveUserContext()` | Org → brand → account scoping via service-role. Solid; unrelated to *beta entry* but is the data-isolation layer. |
| RBAC permission catalog | `lib/security/rbac.ts` | Pure `can(role, perm)` + `requirePermission`. **Defined but NOT wired into most enforcement.** Good home for `security.read`/`users.suspend` later. |
| Kill switches / flags | `lib/security/flags.ts` (`assertNotKilled`, `isFeatureEnabled`) + `system_flags` table (0016) | Live. Env var wins; DB layer cached 30s. |
| Audit spine | `lib/security/audit-log.ts › recordAudit()` + `audit_log` (0015, append-only) | Live. Already has `user.suspend`, `credits.*`, `killswitch.execute` action types. **Use it for approve/suspend/revoke.** |
| Data classification | `lib/security/classification.ts` | Pure table→sensitivity map. Reference for the RLS review below. |
| Owner events | `lib/owner/events.ts › logEvent()` | Lightweight event log used by invite flow. |

### 1.4 The 3 unauthenticated API routes (intended public)
`app/api/leads/route.ts` (PUBLIC book-demo form — keep public; already IP-rate-limited + honeypot + service-role write to `demo_requests`), `app/api/connect/meta/authorize/route.ts` (**bug-adjacent: should require auth** — starts an OAuth flow; verify it reads the user before issuing state), `app/api/influencer/avatar/route.ts` (image proxy — verify it only proxies and cannot be used as an SSRF/cost amplifier).

---

## 2. Route & API classification

Legend: **PUBLIC** (no auth) · **AUTHENTICATED** (signed in, any state) · **PRODUCT_ACCESS** (signed in AND access-state ∈ {APPROVED, ACTIVE, ADMIN}) · **ADMIN_ONLY** (`isAdminEmail`) · **INTERNAL_CRON** (`CRON_SECRET` bearer).

### 2.1 Product pages under `app/app/**`
All of these are gated together by the `app/app/layout.tsx` product gate (§4). Individually:

| Route | Class | Notes |
|---|---|---|
| `app/app` (cockpit) | PRODUCT_ACCESS | Cockpit loader triggers Meta pulls. |
| `app/app/action-center`, `changes`, `funnel`, `reconcile`, `media`, `settings` | PRODUCT_ACCESS | Read own data. `settings` also `getCurrentUser`-guards inline. |
| `app/app/creative`, `creative-production`, `creators`, `creators/[id]`, `influencer`, `market`, `growth` | PRODUCT_ACCESS | Drive the expensive integrations in §3. |
| `app/app/admin` | ADMIN_ONLY | Already gated by `isAdminEmail` via `auth.getUser()` (uses `getUser` deliberately so email is present). **Leave as-is.** |

### 2.2 API routes under `app/api/**`
| Route | Today's check | Target class | Action |
|---|---|---|---|
| `admin/invite`, `admin/keys` | `isAdminEmail` | ADMIN_ONLY | Keep. |
| `cron/sync`, `cron/growth` | `CRON_SECRET` timing-safe bearer | INTERNAL_CRON | Keep. (Model gold-standard: 503 if unset, 401 mismatch, constant-time.) |
| `leads` | none (public form) | PUBLIC | Keep public. |
| `health` | reads env/status | PUBLIC (or AUTHENTICATED) | Keep; ensure it returns no secrets. |
| `connect/meta/authorize` | **none** | AUTHENTICATED + PRODUCT_ACCESS | **FIX: add `getUser` + product gate before issuing OAuth state.** |
| `connect/meta/callback`, `connect/meta/select-account` | `getUser` | PRODUCT_ACCESS | Add product gate. |
| `influencer/avatar` | **none** | AUTHENTICATED (or PUBLIC proxy) | Confirm it cannot amplify cost/SSRF; add auth if it can. |
| `ask` | `getUser` 401 + 24h cap | PRODUCT_ACCESS | Add gate **before** Gemini (§3). |
| `brand/discover`, `brand/profile`, `brand/select`, `brands` | `getUser` | PRODUCT_ACCESS | Gate; `discover`/`profile` call AI + web. |
| `competitors/run`, `competitors/analyze`, `competitors/search` | `getUser` | PRODUCT_ACCESS | Gate **before** ScrapeCreators/Meta. |
| `creative/analyze` | `getUser` | PRODUCT_ACCESS | Gate before Gemini. |
| `creative-production/*` (generate, concepts, assets, brand, products, coverage, shopify/connect, shopify/sync) | `getUser` | PRODUCT_ACCESS | Gate before AI/image/Shopify calls. `generate` is the most expensive (image gen, `maxDuration=300`). |
| `market/positioning` | `getUser` | PRODUCT_ACCESS | Gate before AI. |
| `funnel`, `reconcile`, `meta/accounts`, `meta/campaigns`, `notifications` | `getUser` | PRODUCT_ACCESS | Gate. Meta reads. |
| `ingest/run` | `getUser` | PRODUCT_ACCESS | Gate before ingestion. |
| `influencer/run` | `getUser` | PRODUCT_ACCESS | Gate before ScrapeCreators/IG. |
| `growth/review`, `growth/article` | `getUser` | PRODUCT_ACCESS (+ owner-internal) | Gate; AI-backed. |
| `judgment`, `audit/judgment` | `getUser` | PRODUCT_ACCESS / ADMIN | Gate. |

**Rule:** the product gate is a cheap function call added as the **first line after the existing `getUser()` 401**, and always **before** any expensive-integration call. It never *replaces* the tenancy scoping (`resolveUserContext`) — it runs in front of it.

---

## 3. Expensive integrations and their exact entry points
Gate `requireProductAccess` must sit upstream of every one of these.

| Integration | Cost driver | Library entry | Invoked by (routes) |
|---|---|---|---|
| **Meta Graph / Ad sync** | API quota + latency | `lib/meta-sync.ts` (`fetchLiveCockpit`, `getUserMetaSession`), `lib/ingest/ad-metrics.ts` (`syncAdMetrics`), `lib/ingest/change-history.ts`, `lib/meta-source.ts` | cockpit page, `meta/*`, `funnel`, `reconcile`, `ingest/run`, `connect/meta/*`, `cron/sync` |
| **Gemini / AI router** | Token spend | `lib/ai/router.ts › runTaskText`, `lib/gemini.ts`, `lib/ai/providers/*`, spend attributed via `lib/ai/context.ts › setAiUser` + `ai_usage` (0019) | `ask`, `creative/analyze`, `brand/discover`, `brand/profile`, `market/positioning`, `creative-production/*`, `growth/*` |
| **ScrapeCreators** | Paid credits | `lib/scrapecreators.ts`, `lib/competitors/collect.ts`, `lib/influencer/*` | `competitors/run`, `influencer/run` |
| **Creative production / image gen** | Image API $ | `lib/creative-production/pipeline.ts` (`generateAssetsForConcept`), `intelligence/*` | `creative-production/generate` (worst case: `maxDuration=300`) |
| **Shopify** | API + sync | `lib/creative-production/shopify/store.ts`, `.../shopify/sync` | `creative-production/shopify/connect|sync` |

Existing cost backstops already present (keep, they are complementary, not a substitute): per-user 24h `ASK_DAILY_CAP` via `reserve_ask_quota` RPC (0004), competitor `DAILY_CREATIVE_CAP`, kill switches (`KILL_AI`, `KILL_META_SYNC`, …), `AI_DAILY_CALL_BUDGET` alarm in `cron/sync`.

---

## 4. Design: canonical access-state model

### 4.1 States
```
WAITLIST   -- default for every new signup; no product access
INVITED    -- admin created/invited but user not yet active; no product access until APPROVED
APPROVED   -- admin granted beta access; HAS product access
ACTIVE     -- optional: APPROVED user who has signed in at least once; HAS product access
SUSPENDED  -- temporarily blocked (abuse/billing); no product access, can be restored
REVOKED    -- permanently offboarded; no product access
ADMIN      -- founder/staff; HAS product + admin. (See 4.4 — admin stays env-sourced.)
```
`HAS_PRODUCT_ACCESS := state ∈ {APPROVED, ACTIVE, ADMIN}`. Everything else is fail-closed to no access.

### 4.2 Where the state lives — **new minimal table `public.profiles`**
The task prefers "add a column with a CHECK constraint" over a new table **when a clean profile/entitlement row already exists**. It does not: there is no per-user public row anywhere (`auth.users` is Supabase-managed; `org_members` is org-scoped and not every user is in an org). So a single-row-per-user anchor is required. Keep it minimal and conventional (`profiles`), holding exactly the access fields — no feature creep.

```sql
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  access_state text not null default 'WAITLIST'
                 check (access_state in
                   ('WAITLIST','INVITED','APPROVED','ACTIVE','SUSPENDED','REVOKED','ADMIN')),
  email        text,               -- denormalized for the admin list (nullable; source of truth is auth.users)
  approved_by  uuid references auth.users(id) on delete set null,
  approved_at  timestamptz,
  state_reason text,               -- why suspended/revoked (shown in audit)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```
Rationale for a column-with-CHECK on this table (not an enum type): a `text + CHECK` is reversible with a trivial `drop constraint` and adding a state later is one `alter` — an `enum` type is painful to shrink in a down-migration.

### 4.3 The single cheap server gate — `lib/app/access.ts` (new file)
```ts
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/app/user";
import { isAdminEmail } from "@/lib/admin";

export type AccessState =
  | "WAITLIST" | "INVITED" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "REVOKED" | "ADMIN";

const PRODUCT_OK: ReadonlySet<AccessState> = new Set(["APPROVED", "ACTIVE", "ADMIN"]);

// One cached read per request. Service-role so it works regardless of RLS. FAIL CLOSED:
// any error, missing row, or unknown value => no access.
export const getAccessState = cache(async (): Promise<{ userId: string; email?: string; state: AccessState } | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  // Admin allowlist is the guaranteed brake — an admin is never locked out even if their row is missing.
  if (isAdminEmail(user.email)) return { userId: user.id, email: user.email, state: "ADMIN" };
  try {
    const { data } = await createAdminClient()
      .from("profiles").select("access_state").eq("id", user.id).maybeSingle();
    const state = (data?.access_state as AccessState) ?? "WAITLIST"; // no row => treat as waitlist
    return { userId: user.id, email: user.email, state };
  } catch {
    return { userId: user.id, email: user.email, state: "WAITLIST" }; // DB hiccup => deny product, not 500
  }
});

export async function canAccessProduct(): Promise<boolean> {
  const a = await getAccessState();
  return !!a && PRODUCT_OK.has(a.state);
}
export async function canAccessAdmin(): Promise<boolean> {
  const a = await getAccessState();
  return a?.state === "ADMIN"; // == isAdminEmail; kept as one call site
}
export async function canAccessBilling(): Promise<boolean> {
  return canAccessProduct(); // no billing plane yet; alias so call sites are future-proof
}

// For Server Components / pages: redirect a non-entitled user to the waitlist screen.
export async function requireProductAccess(): Promise<void> {
  const a = await getAccessState();
  if (!a) redirect("/login");
  if (!PRODUCT_OK.has(a.state)) redirect("/waitlist");
}

// For route handlers: return a Response to send instead of redirecting.
export async function guardProductApi(): Promise<Response | null> {
  const a = await getAccessState();
  if (!a) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!PRODUCT_OK.has(a.state)) return Response.json({ error: "Access pending approval" }, { status: 403 });
  return null; // ok
}
```
Fail-closed properties: missing row → WAITLIST; DB error → WAITLIST (never a 500 in the `/app` layout, matching the existing "never throw in layout" rule); admin allowlist short-circuits so **staff can never be locked out by a data problem** (critical for the rollout).

### 4.4 Admin stays env-sourced
`isAdminEmail` (env `ADMIN_EMAILS`) remains the source of truth for admin. The `ADMIN` *state* is a convenience mirror only; the gate derives ADMIN from `isAdminEmail`, so flipping a `profiles` row to non-admin can never demote the founder, and losing the DB can never lock admins out. This deliberately keeps admin authority outside the table an attacker would target first.

---

## 5. Enforcement layers

### 5.1 Navigation (page) layer — `app/app/layout.tsx`
Add one line after the existing session guard:
```ts
const user = await getCurrentUser();
if (!user) redirect("/login");
await requireProductAccess();   // NEW: non-entitled -> /waitlist
```
Because `getAccessState` is `cache()`d and `requireProductAccess` calls `getCurrentUser` internally, this is at most **one extra service-role read per navigation**, deduped with the layout's own user read. `app/app/admin/page.tsx` keeps its own `isAdminEmail` check (admin must render even for an ADMIN whose product flow is irrelevant).

### 5.2 API layer — every PRODUCT_ACCESS route
Insert immediately after the current `getUser()` 401, **before** any expensive call:
```ts
const denied = await guardProductApi();
if (denied) return denied;
```
This is the load-bearing layer: middleware can be bypassed by hitting the API directly, so the API gate is what actually protects spend. Apply to the full PRODUCT_ACCESS list in §2.2. Do **not** add it to `leads`, `health`, `cron/*`, `admin/*` (those have their own correct gates).

### 5.3 Middleware layer — `proxy.ts` (navigation defense-in-depth, optional-but-recommended)
Two options:
- **Minimal (recommended first ship):** leave `proxy.ts` as the session gate; rely on the layout gate (§5.1) for product-access on navigation. Simpler, no edge DB read, no new failure mode.
- **Enhanced (later):** add `access_state` as a **custom JWT claim** via a Supabase *custom access token hook*, so `getClaims()` in both `proxy.ts` and `getCurrentUser` sees the state with **zero extra DB cost**, and middleware can redirect WAITLIST→`/waitlist` at the edge. This also makes the API gate free. Trade-off: a state change only takes effect on the user's next token refresh (≤1h) unless you force a refresh; SUSPEND/REVOKE therefore must **also** be enforced by the service-role API gate (which reads live), so suspension is immediate on the expensive paths regardless of the stale claim. Keep §5.2 as the authoritative real-time gate.

### 5.4 RLS review (defense-in-depth — NOT the primary gate)
Reality: features read/write through the **service-role** admin client (`createAdminClient`), which **bypasses RLS entirely**. So RLS cannot enforce beta access for the app's own code paths; it only protects against a leaked anon key / direct PostgREST access. The primary beta gate is §5.1–5.2. Still, close the RLS gaps found:

| Table (sensitive) | RLS today | Policy today | Recommendation |
|---|---|---|---|
| `oauth_tokens` | ON | none (deny-all) | Correct. Leave. |
| `ad_accounts` | ON | own (`auth.uid()=user_id`) | Leave. |
| `brands`, `competitors`, `competitor_ads`, `triples`, `test_plans`, `test_plan_items` | ON | own (0001) | Leave. Note `brands` is now also org-scoped (0009) but RLS still checks `user_id`; acceptable since reads go via service-role + `resolveUserContext`. |
| `shopify_connections`, `provider_keys`, `ad_changes`, `notifications`, `ai_usage`, `creative_semantics` | ON | none (deny-all) | Correct (service-role only). Leave. |
| **`ad_metrics`, `ad_meta`, `cockpit_cache`, `brand_profiles`, `creative_insights`, `cp_assets`, `cp_generations`, `cp_concepts`, `cp_brand_dna`, `cp_product_dna`, `decision_triples`, `competitor_creative_analysis`, `demo_requests`, `orgs`/`org_members`/`brand_members` (policies absent)** | **OFF or enabled-without-policy inconsistently** | — | **Add `enable row level security` with NO policy (deny-all to anon/authenticated).** Zero app impact (service-role bypasses), removes the "leaked anon key reads customer metrics" risk. Ship as a **separate** migration from the access-state one so an RLS mistake can be rolled back independently. |

The access-state table itself: `profiles` gets RLS ON with a self-read policy (`auth.uid() = id`) so the browser can read *its own* state to render the waitlist screen, and **no** self-update policy (state changes are service-role only, via the admin API).

---

## 6. The migration (reversible)

**Numbering hazard:** the migrations dir already has colliding numbers (`0017_*` ×3, `0018_*` ×3, `0019_*` ×3); highest is `0021_provider_keys`. Files are described as "non-authoritative mirrors" — **migrations are applied live via the Supabase MCP**, not by a runner. Use a clearly-named next number and apply through MCP. Before applying, run `list_migrations` / check `information_schema` to confirm no `profiles` table or `handle_new_user` trigger already exists (a concurrent session may have added one — see §10).

### 6.1 UP — `supabase/migrations/0022_access_state.sql`
```sql
-- 0022 Private-beta access control. Additive + reversible. Safe to re-run.

-- 1) Access anchor (one row per auth user).
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  access_state text not null default 'WAITLIST',
  email        text,
  approved_by  uuid references auth.users(id) on delete set null,
  approved_at  timestamptz,
  state_reason text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- CHECK as a named, droppable constraint (reversibility > enum type).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_access_state_chk') then
    alter table public.profiles add constraint profiles_access_state_chk
      check (access_state in ('WAITLIST','INVITED','APPROVED','ACTIVE','SUSPENDED','REVOKED','ADMIN'));
  end if;
end $$;

create index if not exists profiles_state_idx on public.profiles(access_state);

-- 2) RLS: user may read ONLY its own row (for the waitlist screen). No self-insert/update:
--    state transitions are service-role only.
alter table public.profiles enable row level security;
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);

-- 3) Auto-provision a WAITLIST profile whenever a new auth user is created.
--    SECURITY DEFINER so it can write regardless of the caller. Idempotent.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, access_state)
  values (new.id, new.email, 'WAITLIST')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) CRITICAL lock-out safety: backfill EVERY existing user.
--    a) everyone who currently owns real data (an ad_accounts row) => APPROVED.
--    b) any existing user with NO profile row that we did not approve => APPROVED too,
--       because every user that exists TODAY predates the gate and must not be locked out.
--       (New WAITLIST defaulting only applies to signups AFTER this migration, via the trigger.)
insert into public.profiles (id, email, access_state, approved_at, state_reason)
select u.id, u.email, 'APPROVED', now(), 'backfill: pre-beta existing user'
from auth.users u
on conflict (id) do update
  set access_state = 'APPROVED',
      approved_at  = coalesce(public.profiles.approved_at, now()),
      state_reason = coalesce(public.profiles.state_reason, 'backfill: pre-beta existing user')
  where public.profiles.access_state = 'WAITLIST';  -- only lift waitlisted; never downgrade a set state
```
Notes:
- Step 4 runs **after** the trigger is created, so it is race-safe against a signup landing mid-migration (that signup gets WAITLIST from the trigger and, if it is a brand-new person, correctly stays WAITLIST because the `on conflict ... where access_state='WAITLIST'` **would** lift it — see the caveat below).
- **Caveat / decision:** the blanket "all existing `auth.users` → APPROVED" is the safe choice for a tiny private beta where every current account is a real tester or the founder. If the user base already contains unknown self-signups you do NOT want in, narrow step 4(b) to only `ad_accounts` owners + `org_members` + `isAdminEmail` addresses, and manually approve the rest. **Confirm the intended set with the product owner before running.** (Top risk — see §10.)

### 6.2 DOWN — `supabase/migrations/0022_access_state_down.sql`
```sql
-- Reverses 0022. Enforcement code must be removed/disabled FIRST (see §10 ordering),
-- otherwise the app will fail closed (everyone -> /waitlist) once profiles is gone.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop policy  if exists "own profile read" on public.profiles;
drop table   if exists public.profiles;   -- cascade not needed; only FKs point INTO it via approved_by(set null)
```
The separate RLS-hardening migration (§5.4) has its own down that simply `disable row level security` on the tables it enabled — kept independent so a bad RLS change never forces reverting the access-state work.

---

## 7. Waitlist page + admin approve/suspend/revoke

### 7.1 Waitlist screen — `app/waitlist/page.tsx` (new, public-ish)
A signed-in but non-entitled user is redirected here by `requireProductAccess`. It reads its own `profiles` row (allowed by the self-read RLS policy) and shows state-appropriate copy: WAITLIST → "You're on the list"; SUSPENDED/REVOKED → contact support; plus a sign-out button. Must **not** live under `/app` (that segment redirects it back here — infinite loop). Add `/waitlist` to the proxy's public set implicitly (it is not under `/app`, so `proxy.ts` already treats it as public — no matcher change needed).

### 7.2 Admin controls — extend the existing console `app/app/admin/page.tsx`
It already renders `AdminControls` and is `isAdminEmail`-gated. Add a "Beta access" card listing `profiles` joined to `auth.users` (email, state, approved_at) with Approve / Suspend / Revoke buttons, backed by a new admin API:

`app/api/admin/access/route.ts` (ADMIN_ONLY):
```ts
// POST { userId, action: 'approve'|'suspend'|'revoke'|'reinstate', reason? }
// 1) getUser + isAdminEmail  -> else 403
// 2) map action -> state: approve->APPROVED, suspend->SUSPENDED, revoke->REVOKED, reinstate->APPROVED
// 3) createAdminClient().from('profiles').update({access_state, approved_by, approved_at, state_reason})
// 4) recordAudit({ action: action==='suspend'?'user.suspend':'credits.grant'..., actorId, targetType:'user', targetId:userId, before, after, result })
//    (audit_log already defines 'user.suspend'); logEvent('access.'+action, ...)
```
Reuse the invite path (`app/api/admin/invite`) to bring a person in as INVITED, then Approve. No new email infra needed.

---

## 8. Functional test list (must pass after each layer)
1. **Existing user unaffected:** a backfilled APPROVED user (has `ad_accounts`) loads `/app`, cockpit, settings — no redirect, Meta/AI features work.
2. **Founder/admin:** `isAdminEmail` account reaches `/app` and `/app/admin` even if its `profiles` row is missing/WAITLIST (allowlist short-circuit).
3. **New signup:** register a fresh email → trigger writes WAITLIST → `/app` redirects to `/waitlist`; the waitlist page shows "on the list".
4. **Approve:** admin approves the new user → user reloads `/app` → now enters. (If custom-claim mode §5.3-enhanced is used, verify it takes effect after token refresh AND that the API gate lets them in immediately.)
5. **Suspend/Revoke:** admin suspends an APPROVED user → next navigation → `/waitlist`; every expensive API returns 403.
6. **Reinstate:** SUSPENDED → APPROVED restores access.
7. **DB down:** simulate `profiles` read failure → non-admin sees `/waitlist` (fail closed), admin still in, `/app` layout does not 500.

## 9. BYPASS test list (the security cases — each must be BLOCKED)
1. **Direct API, no gate:** a WAITLIST session `POST`s `app/api/creative-production/generate`, `/api/ask`, `/api/competitors/run`, `/api/ingest/run`, `/api/connect/meta/authorize` → **403 before any Meta/Gemini/ScrapeCreators/image call**. (Confirm the expensive call is never reached — check `ai_usage` / provider logs show zero new spend.)
2. **Direct URL nav:** WAITLIST user hits `/app/market`, `/app/creative-production`, `/app/admin` directly → redirected (`/waitlist`; admin → its own "administrators only" panel).
3. **Stale session / stale JWT:** user approved then REVOKED keeps an unexpired cookie → the **service-role API gate reads live state** and returns 403 even though the JWT claim (if used) is stale. Verify SUSPEND is immediate on `/api/*`.
4. **Background-job enqueue:** a WAITLIST user cannot cause `cron/sync` work — cron is `CRON_SECRET`-only and iterates `ad_accounts`; a waitlisted user has none, so no sync is enqueued for them. Confirm no user-triggered enqueue path (e.g. `connect/meta/authorize`) lets them create an `ad_accounts` row pre-approval.
5. **Cache read:** a REVOKED user cannot read another/own cached cockpit via any route — `cockpit_cache` reads are behind the gated pages/APIs; confirm no ungated route returns `cockpit_cache`/`ad_metrics` rows.
6. **RLS/anon-key probe:** with only the anon key (no session), direct PostgREST `select` on `ad_metrics`/`cockpit_cache`/`profiles`(other id) returns **zero rows** after §5.4 hardening.
7. **Self-escalation:** a normal user cannot `update` their own `profiles.access_state` (no self-update policy; service-role only). Verify a crafted PostgREST `PATCH /profiles?id=eq.<me>` with anon/authenticated key is denied.
8. **Trigger integrity:** signing up cannot choose a state — `handle_new_user` hard-codes WAITLIST regardless of any client-supplied metadata.

---

## 10. Ordered execution checklist
1. **Confirm the approved set** with the product owner (blanket-existing-users vs `ad_accounts`+`org_members`+admins only). This decides step 6.1(4). **Do not run the migration until decided.**
2. Verify no concurrent divergence: `list_migrations`; check `profiles` table / `on_auth_user_created` trigger do not already exist; `git status` clean-ish and coordinate (see risks).
3. Ship **code first, gates OFF-equivalent**: add `lib/app/access.ts`, `app/waitlist/page.tsx`, `app/api/admin/access/route.ts`, admin UI card — but do **not** yet add the `requireProductAccess`/`guardProductApi` call sites. (This code is inert without them.)
4. Apply migration `0022_access_state.sql` via Supabase MCP. Immediately verify: founder row/allowlist works, all existing users are APPROVED, a test signup is WAITLIST.
5. Turn on the **API gate** (§5.2) on all PRODUCT_ACCESS routes — this is the spend-protecting layer, land it before the page gate.
6. Turn on the **layout gate** (§5.1).
7. (Optional, later) Apply the separate **RLS-hardening** migration (§5.4) and, if desired, the **custom-claim** enhancement (§5.3).
8. Run the full §8 + §9 lists on the **live** app (project rule: never claim green without testing live). Watch `ai_usage`/provider dashboards to prove zero spend on blocked calls.
9. Record in `audit_log` that the gate went live; append a dated line to the repo's memory/feedback ledger.

**Reversal order (if needed):** remove the §5.1/§5.2 call sites (or set an env `BETA_GATE_OFF=1` kill escape if you build one) → then run `0022_access_state_down.sql`. Never drop `profiles` while the gate code is live (everyone would fail closed to `/waitlist`).

---

## 11. TOP RISKS
1. **Locking out existing working users (highest).** The gate fails closed; if the backfill misses anyone (e.g. a real tester who has signed in but never connected an ad account, so owns no `ad_accounts` row), they get `/waitlist` on their next load. **Mitigation:** the §6.1(4) backfill approves *all* current `auth.users`, not just `ad_accounts` owners; the admin allowlist short-circuit guarantees staff are never locked out; ship code before migration and API-gate before page-gate so you can catch it on one surface first. **Verify the exact current user list before running.**
2. **Concurrent second Claude/dev session editing this repo.** Migrations here are applied *live via MCP*, and files are non-authoritative mirrors, so two sessions can (a) both create `profiles`/the trigger (idempotent guards above make this safe — `if not exists`, `on conflict do nothing`, `create or replace`), or (b) pick the same/rebase migration number, or (c) one session flips enforcement while the other is mid-edit. **Mitigation:** before applying, re-check live schema via MCP (`list_migrations`, look for `profiles`/`on_auth_user_created`); use a clearly-named number (`0022_access_state`) and announce it; make every DDL idempotent (done); do not enable both gate layers in the same commit as the migration.
3. **Fail-open on the wrong axis.** If someone "fixes" the DB-error branch in `getAccessState` to allow access on error (to avoid lockout), the beta gate becomes bypassable by inducing a DB error. **Keep it fail-closed for non-admins**; the admin allowlist is the intended relief valve, not error-open.
4. **Expensive call before the gate.** The API gate must be the **first** statement after `getUser()`, before `resolveUserContext`, `fetchLiveCockpit`, `runTaskText`, ScrapeCreators, image gen. A gate placed after an `await someMetaCall()` still burns money. Grep each PRODUCT_ACCESS route to confirm ordering during review.
5. **`connect/meta/authorize` is currently unauthenticated.** Until fixed, a waitlisted (or anonymous) user could initiate an OAuth handshake. Fix it in the same change set (add `getUser` + `guardProductApi`).
6. **Stale JWT if custom-claim mode is adopted.** A REVOKED/SUSPENDED user keeps access on cached pages until token refresh unless the live-reading API gate is also present. **Always keep §5.2 as the real-time authority**; treat the claim as a fast-path hint only.
