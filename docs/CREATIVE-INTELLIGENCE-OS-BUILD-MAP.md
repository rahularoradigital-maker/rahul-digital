# Creative Intelligence OS — build map (vision → reality → sequence)

**Date:** 2026-09-03 · **Status:** PLAN — no code changed. A new table is a schema migration (your audit's stop condition), so this asks before building.

The target you drew is a closed loop: **Brand + Market knowledge → Pattern extraction → Creative Database → Strategist → Concepts → AI pre-production → Human review → Meta test → Performance → Creative Memory → next iteration.**

The key finding: **~60% of this already exists in the codebase, in fragments.** The OS is not a rewrite — it's **a spine that unifies what's there, plus a memory loop that closes it.** Ponytail rule applies: reuse, don't rebuild.

---

## 1. Vision box → what exists today (grounded)

| OS box | Status | Where it lives now | Gap |
|---|---|---|---|
| **Brand Knowledge** — voice/persona | ✅ built | `lib/brand/{profile,auto,discover,parse}.ts`, `brand-dna.ts`, `cp_brand_dna` | scattered, not one read |
| Brand — offers/products | ✅ built | Shopify (`cp_product_dna`, `shopify_products`, `creative-production/shopify/*`) | needs Rahul's Shopify token to be live |
| Brand — past creative | ✅ built | `ad_meta`, `lib/creative/deep-decode`, `creative_semantics` (0017), `own_creative_fingerprints` | not linked to patterns |
| Brand — performance data | ✅ built | `ad_metrics` (14.6k rows), rollups, winner/wasting flags | — |
| **Market Intel — competitors** | ✅ built | `lib/competitor*`, `competitor_ads`, Meta Ad Library | ScrapeCreators out of credits |
| Market Intel — TikTok/IG/YouTube **ad patterns** | ❌ **gap** | ScrapeCreators MCP tools exist; influencer uses IG only | no ad-creative pattern ingestion |
| Market Intel — Reddit/**Reviews (Echo)** | 🟡 partial | `lib/growth/discover` (Reddit/HN); "Echo" is marketed but **not built** | voice-of-customer → objections/proof |
| **Pattern Extraction** — visuals/formats | ✅ built | `deep-decode` (scene/mood/format), `ad-format-library` | — |
| Pattern Extraction — angles | ✅ built | `lib/creative-production/strategy/gap-angles.ts` | — |
| Pattern Extraction — hooks/objections/triggers/proof/language/personas | ❌ **gap** | none structured | no taxonomy/extractor |
| **Creative Database** (unified patterns) | ❌ **gap — the missing spine** | fragments: `creative_semantics`, fingerprints, `cp_*` | **no single patterns table** |
| **Creative Strategist → Concepts/Blueprints** | ✅ built | `studio.tsx` + `creative-production/{concept-generate,recommend,strategy,test-set}` | generates blind, not from proven patterns |
| Static | ✅ built | `providers/openai-image.ts` (SCENE mode, 42 formats) | — |
| UGC | ❌ gap | — | — |
| Video | ❌ gap | deprecated (ADR-0001) | — |
| **AI Pre-production** — image + copy | ✅ built | image gen + concept copy | — |
| Pre-production — voice | ❌ gap | — | needs a voice API |
| Pre-production — video | ❌ gap | — | needs a video API |
| **Human Review** | ✅ built | Studio approve/reject, QA lint | — |
| **Meta Test** (push draft to Meta) | ❌ **gap** | PNG/ZIP export for manual upload; `ads_create_creative` MCP exists but not wired | draft-push (DRAFTS-only rule allows it) |
| **Performance Data** | ✅ built | `ad_metrics` ingest + rollups | — |
| **Creative Memory Engine → next iteration** | 🟡 partial | `lib/intelligence/{outcome,predict,grade-store}.ts` (learning loop, in flight) | **not linked to the pattern DB** |

**Two things turn the pile of fragments into an OS:** (1) the **Creative Database** (a shared patterns table), and (2) the **Memory Loop** (performance → which patterns won → feed the strategist). Everything else is an inflow (social/reviews) or an outflow endpoint (voice/video/meta-push).

---

## 2. Build sequence (reuse-first, lowest-risk spine first)

> Each phase is additive and gated. Heaviest/most external-dependency-bound work is last. No golden money-path (scoring/cockpit) is touched.

**Phase A — The Creative Database (the spine).** One `creative_patterns` table + a typed model:
`{ type: hook|angle|objection|visual|persona|trigger|proof|format|language, text, source: own_ad|competitor|social|review, sourceRef, brandId, performance: {impressions,spend,roas}|null, createdAt }`.
Populate it from **what already exists** — an extractor that turns `deep-decode`/`creative_semantics` DNA + `gap-angles` + `competitor_ads` into pattern rows. Pure model + extractor + `check:creative-patterns`. **This is the unifying move; every other box plugs into this table.**

**Phase B — Close the memory loop.** Link each own-ad's patterns → its `ad_metrics` performance → a **per-pattern win-rate** (reuse rollups + `lib/intelligence/outcome`). Now "what actually worked" is a fact, per brand, not a guess.

**Phase C — Feed the Strategist from the DB.** Studio concept generation reads the **top proven patterns** (by win-rate) for the brand instead of generating blind. Reuses `concept-generate` + the strategist prompt. This is where the loop starts to compound.

**Phase D — Market-intelligence inflow.** Wire competitor ads (Meta Ad Library — already have) + social (ScrapeCreators MCP) + reviews (**Echo**) → the same pattern extractor → the creative DB. Now the strategist learns from the whole market, not just your own account.

**Phase E — Production + test endpoints (heaviest, external-gated).** Voice, video, UGC generation, and **Meta draft-push** (`ads_create_creative`, DRAFTS-only). These need Rahul's provider keys (voice/video) and Meta write-scope, so they come last.

---

## 3. The compounding loop (why this order)

```
Phase A (patterns DB)  → one place everything reads/writes
  Phase B (memory)     → patterns get a proven win-rate
    Phase C (strategist reads winners) → concepts start from proof, not guesses
      → better creatives → tested on Meta (Phase E) → performance data
        → feeds back into the win-rate (B) → the OS gets smarter each cycle
   Phase D (market inflow) widens the pattern pool the whole loop draws from
```
This is exactly the flywheel the master audit said the product lacks today. Phase A+B+C is the minimum to make it turn.

---

## 4. Recommended first slice

**Phase A — the `creative_patterns` table + extractor from existing DNA.** It is additive, in the data/creative lane, touches no golden path, and unlocks everything downstream. It reuses `deep-decode`, `creative_semantics`, and `gap-angles` rather than rebuilding them.

**But it needs a new table = a schema migration, which is your stated stop condition.** So I'm asking before applying it.

---

## 5. Risks / guardrails

- **Reuse, don't rebuild:** every phase wraps existing extractors; if I catch myself re-implementing `deep-decode` or `gap-angles`, stop.
- **Coordinate with the creative/studio lanes** (studio.tsx is another session's hot file) — Phase C touches their surface; I'll claim it and prefer new files.
- **No new provider deps until Phase E**, and only with your keys.
- **DRAFTS-only rule holds** even at Meta-push: a pushed creative is a paused draft for human review, never live-spending.
- **Gate every phase** (tsc + build + a new `check:*` + live-verify).

---

## Decision for you
1. **Green-light Phase A** (the `creative_patterns` spine + extractor + migration `0038`)? It's the unlocking move and everything plugs into it.
2. **Or** re-order — e.g. start with **Echo/reviews** (voice-of-customer) or **Meta draft-push** if one of those is more urgent for you.
3. Confirm I can **apply a new migration** for this (your audit lists schema migration as a stop condition — this is me stopping to ask).
