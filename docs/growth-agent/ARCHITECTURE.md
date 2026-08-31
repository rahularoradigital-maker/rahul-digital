# Scout — Growth Intelligence System: Architecture & Enterprise Gap Map

_Per the spec's Loop 1 (DISCOVER: read the codebase, reuse, don't duplicate) and §72 (no duplicate systems).
This maps the 73-section enterprise spec to what ALREADY EXISTS in Scout + the AdScale app, so we build only
what's missing. Labels: **FACT** (verified in code) · **INFERENCE** · **ASSUMPTION**. Honest: this is a
multi-month, 100-eng-org program; below is the real state + the phased path, not a claim it's all built._

## Reality first (what's already built — reuse, don't rebuild)

**FACT** — Scout today (`lib/growth/`, live on rahul-digital) already implements a large slice of the spec:

| Spec layer | Built as | Status |
|---|---|---|
| Source layer + adapters (§3–4) | `discover.ts`: HN, StackExchange, Google News (+Reddit ready) behind one Conversation shape | ✅ partial |
| Ingestion → normalize → dedup (§10) | `discover.ts` normalizes to Conversation, de-dupes by id | ✅ |
| Content object (§12) | `Conversation` type (`engine.ts`) | ✅ (text; no multimodal) |
| Intent engine (§19) | `matchIntent` + ad-context guard | ✅ (heuristic) |
| Topic + demand signal (§17–18) | `brief.ts` demand-signal clustering → content idea | ✅ |
| Opportunity scoring (§21) | `engine.ts` 10 documented weights (sum=1), explainable | ✅ |
| Decision engine (§22) | `engine.ts` IGNORE/MONITOR/LEARN/DRAFT/REQUEST_APPROVAL — provably never PUBLISH | ✅ |
| Product-mention gate (§24) | `promotionGate` (all-must-pass) | ✅ |
| Response/content engine (§23,27) | `draft.ts` (AI replies) + `articles.ts` (AI articles) → `/blog` | ✅ |
| Approval queue (§26) | `growth_drafts` + `/app/growth` review queue + article drafts, audited | ✅ |
| Autonomy levels (§25) | draft-only ceiling; one-tap approve/publish; no unattended community posting | ✅ (safe) |
| Attribution (§51) | `attribution.ts` UTM-tags every AdScale link | ✅ (foundation) |
| Memory (§41) | `growth_briefs` / `growth_drafts` / `growth_articles` (DB) | ✅ partial |
| Scheduling (§54) | Vercel daily cron + GitHub Actions 2-hourly | ✅ |
| Owner control center + brief (§52–53) | `/app/growth` dashboard | ✅ partial |
| **Security/audit/cost/observability (§55,60,61,62,68)** | **REUSE the app's control plane** — `audit_log`, `system_flags` kill switches, RBAC, classification, AI cost (`lib/ai/usage.ts`) + admin console, timing-safe cron, SSRF guard | ✅ **exists — do NOT rebuild** |

**Consequence:** the spec's enterprise scaffolding (secrets plane, audit, kill switches, tenant isolation,
cost tracking, reproducibility spine) is **already the app's control plane** (see `docs/security/`). Scout
plugs into it. We add growth-specific primitives, not a parallel enterprise stack.

## The 20-layer model → Built / Partial / Missing

- Source → Ingestion → Normalization → Dedup → **Built** (§3–10)
- Content Understanding (**text Built; MULTIMODAL §11 MISSING** — no image/video/transcript analysis)
- Intent → **Built (heuristic; AI-qualifier is an upgrade)**
- Entity/Topic → **Partial** (topics yes; entity graph no)
- Evidence + Validation (§14–16) → **MISSING** (the spec's #2 priority: T0–T4 tiering, contradiction engine)
- Opportunity → Decision → **Built + explainable**
- Content → **Built** (replies + articles)
- Policy + Safety (§46–49) → **Partial** (promotion gate + draft-only + reuse kill switches; no per-platform
  policy registry / anti-spam frequency engine yet)
- Approval → **Built**
- Distribution → **Built (owned: /blog; community = one-tap human)**
- Attribution → **Foundation built (UTM); signup-capture MISSING**
- Performance → **MISSING** (community/topic ROI rollups)
- Learning → **MISSING** (closed-loop: outcomes → weight tuning)
- Memory → **Partial** (stores exist; governance/expiry/contradiction MISSING §42)
- Strategy → **MISSING**

## Missing enterprise primitives — phased build (each reuses existing infra)

**Phase A (foundations, buildable now, no external deps):**
1. **Source Registry (§5)** — one table: every adapter's method/health/rate-limit/last-success. _[building now]_
2. **Evidence tiering + claim status (§13–14)** — tag each claim/opportunity T0–T4; block T3/T4 from becoming
   rules (§34 rule quarantine). Pure, testable. The spec's #2 priority.
3. **Reproducibility (§68)** — record prompt/model/rule versions on each Scout decision, into the EXISTING
   `audit_log` (reuse). No new audit system.
4. **Rate-limit + policy registry (§46–47)** — one central table (reuse the app's `system_flags` pattern), so
   per-community promo rules + per-source limits live in one place, not scattered.
5. **Memory governance (§42)** — add confidence/expiry/status to stored items; a contradiction record instead
   of silent overwrite.

**Phase B (needs live traffic or one-time setup):**
6. Attribution close-loop (§51) — capture `utm_*` on landing → signup event. Needs the auth flow + traffic.
7. Performance + learning engines (§38–40, §21 closed-loop) — community/topic ROI → tune weights. Needs traffic.
8. Multimodal understanding (§11) — image/video/transcript. Needs a vision model budget + connectors.
9. Creator/profile registry + monitoring (§6–7) — needs the platform connectors (Reddit app, YouTube key…).

**Phase C (won't build unattended):** community auto-posting (§25 Level 4) stays a human tap — ToS bans + brand.

## What needs the owner (one-time, none blocks Phase A)
- Reddit free app; YouTube key; LinkedIn app; X paid API — the connectors for §6 profile monitoring + wider §3
  sources. Everything in Phase A is buildable with zero external setup.

## Docs (§69)
This file is `ARCHITECTURE.md`. As each primitive lands, its focused doc joins `/docs/growth-agent/`
(SOURCE_CONNECTORS, EVIDENCE_ENGINE, DECISION_ENGINE, etc.). We don't pre-write docs for unbuilt systems.

---

_Principle (§65, §72, final): reuse the app's control plane; build growth-specific intelligence on top; every
Scout decision stays explainable, traceable (audit_log), reproducible (versions), and reversible (draft-only).
Optimize for qualified value per unit of attention — not volume._
