# Risk Audit — AI Layer (Phase 0, READ-ONLY)

Scope: `lib/ai/*`, `lib/gemini.ts`, `lib/prompts/*`, `lib/validator.ts`, and every `callGemini`/`callGeminiText`/`runTaskText`/`runTaskJson` call site. Charter lenses applied: §68 (AI must not own deterministic/financial truth), §69 (untrusted-input fencing), §70 (every AI call justified vs rules/SQL), §71 (context strategy), §100 (cost controls). Evidence cited `file:line`. UNKNOWN where unverifiable in static read.

---

## 1. Architecture (verified)

All routed AI goes through `lib/ai/router.ts`. `runTaskText`/`runTaskJson` (router.ts:24,38) apply, in order: `isKilled("ai")` global kill switch → `aiBudgetExceeded()` daily USD ceiling → `setAiTask()` (spend attribution) → walk `chain(kind)` (primary + fallbacks) until a non-null reply. Providers (`lib/ai/providers/{gemini,openai,anthropic}.ts`) each return `null` on any failure (failure-isolation), record spend on success (`lib/ai/spend.ts` → `ai_usage`, priced by `lib/ai/token-pricing.ts`). Routes: `lib/ai/config.ts:24-32` (7 `TaskKind`s, env-overridable).

Decisioning is deterministic by design: `lib/judgment/{engine,agent}.ts` — "The MATH decides; the corpus names the reasoning; an optional AI pass only narrates" (agent.ts:9). This is the strongest §68 pattern in the codebase and is genuinely wired (`app/api/judgment/route.ts:90`).

---

## 2. AI call-site inventory (12 logical sites; ~19 physical invocations)

| # | Site (file:line) | Purpose | TaskKind / model | Deterministic? | Cost control |
|---|---|---|---|---|---|
| 1 | `app/api/ask/route.ts:114,127` | Ask AdScale grounded Q&A | ask → gemini-flash-lite | AI restates numbers; **deterministic recheck** via `lib/ask-grounding.ts` (regenerate-on-ungrounded) | ASK_DAILY_CAP=50 (route:16); token meter; router budget/kill |
| 2 | `app/api/market/positioning/route.ts:99` | ICP + pillars prose | positioning → gemini-flash-lite (fb Claude Sonnet) | AI emits real ROAS in prose; **prompt-only** guard | rate-limit 30/10min; cached in `creative_insights` |
| 3 | `app/api/creative/analyze/route.ts:107` | Brand Brain + Concepts prose | analyze-text → gemini-flash-lite | AI emits ROAS/spend/wastedRs; **prompt-only** guard | rate-limit 30/10min; cached |
| 4 | `lib/judgment/agent.ts:132` (`narrate`) | Prose over finished verdicts | decision-verdict → Claude Sonnet | Narration only; explicitly "Do NOT change any verdict" | inherits router; opt-in |
| 5 | `lib/brand/profile.ts:68` (`deriveBrandProfile`) | Brand profile from ad data | brand-profile → gemini-vision (fb Claude) | AI infers category/price/market | user reviews draft→confirmed before use |
| 6 | `lib/brand/profile.ts:95` (`suggestCompetitorNames`) | Competitor brand names | brand-profile | AI invents names, **resolved to real Ad Library page, dropped if not found** | contained downstream |
| 7 | `lib/agents/creative/agents.ts:56` (6 agents) | 22-attr creative decode | creative-vision → gemini-vision (fb gpt-4o-mini) | schema-bounded strings | REQUEST_CAP=40, DAILY_CREATIVE_CAP=300 (`competitors/analyze:18,23`); global-dedup by content_hash |
| 8 | `lib/growth/draft.ts:24` (`writeDraft`) | Community reply DRAFT | analyze-text | never posted; `checkContent` gate | draftTop cap=5 |
| 9 | `lib/growth/articles.ts:30` (`generateArticle`) | Blog article DRAFT | concept-gen → Claude Sonnet | draft only; `checkContent` gate | topic-dedup |
| 10 | `lib/creative-production/intelligence/llm-json.ts:8` (`deriveJSON`) | Product/Brand DNA + concepts JSON | concept-gen | grounding "enforced by caller's prompt" | UNKNOWN per-caller caps |
| 11 | `lib/creative/decode.ts:69` (`decodeCreativeCopy`) | Semantic copy dims | analyze-text | fingerprint-once; fenced | decodeMissing max=15 |
| 12 | `lib/creative/decode.ts:117` (`decodeCreativeVisual`) | Visual dims | **direct `callGemini`, bypasses router** | fingerprint-once | decodeMissingVisual max=10; **NO kill/budget guard** |

Not AI: `ImageResponse` (OG images), `lib/judgment/engine.ts`, influencer scoring, rules corpus — all pure/deterministic (correctly excluded from `TaskKind`, tasks.ts:3).

---

## 3. Where AI touches numbers/decisions it shouldn't (§68)

- **P1 — The designed financial honesty-gate is DEAD CODE.** `lib/prompts/strategist.ts` (money_impact "COPIED VERBATIM") + `lib/validator.ts` `validateStrategistOutput` (money_impact must exact-match `authoritativeNumbers`; evidence ids must be a subset) are referenced **only** by `scripts/check-validator.ts` — no runtime import (grep confirms zero non-script callers). The charter/architecture story ("every recommendation traces back to specific data", ai-audit-architecture.md:125-127) is enforced for a component that is not in any live path.
- **P2 — Live advisory prose owns numbers with prompt-only grounding.** Positioning (route:99) and Brand Brain/Concepts (route:107) feed real ROAS/spend/wastedRs into the model and let it restate them in prose. Unlike Ask (site 1, which has `ungroundedNumbers` deterministic recheck), these have **no post-generation number verifier** — a garbled/hallucinated figure reaches the user. §68: AI is restating financial truth without a deterministic gate.
- **Mitigated / OK:** Ask (deterministic recheck, ask-grounding.ts:32); judgment narrate (verdict fixed upstream); competitor names (resolved against real data); brand profile (human-confirmed draft).

---

## 4. Cost-control gaps (§100)

- **P1 — `decodeCreativeVisual` (decode.ts:117) bypasses the router**, so vision spend is **not** subject to `isKilled("ai")` or `aiBudgetExceeded()`. Fired fire-and-forget from `lib/meta-sync.ts:401` and `lib/cockpit/from-store.ts:411` on every sync. Copy decode (decode.ts:69) uses the router correctly — inconsistent.
- **P2 — No global cost ceiling by default.** `AI_DAILY_COST_BUDGET` ships blank (`.env.local.example:55`); with it unset, `aiBudgetExceeded()` returns false always (budget.ts:17-18). Only per-feature caps stand between a loop/bug and an unbounded bill.
- **P3 — Budget check fail-opens on DB error** (budget.ts:29) and sums rows in JS (self-noted ponytail ceiling). A Supabase hiccup silently disables the ceiling.
- Good: fingerprint-once (content_hash), insight caching, per-route caps, `CALLS_PER_CREATIVE` pinned (orchestrator.ts:31), list-price accounting even for $0 Gemini free tier.

---

## 5. Context strategy (§71) — MATCH

No whole-DB dump found. Every route hands the model a compact, bounded snapshot (`ask/route.ts:77-88`; leaderboard `.slice(0,18/20)`, `topActions.slice(0,8)`). Matches the doc's "typed contracts underneath, not autonomous agents over raw data" (ai-audit-architecture.md:114). Token bloat is not a risk here.

---

## 6. Untrusted-input fencing (§69, compose())

`compose()` (`lib/ai/compose.ts`) is a solid boundary (guard rule + fence + `sanitizeUntrusted` strips markers). Used by sites 1,2,3,4,8,9,11. **Gaps:**

- **P2 — `lib/agents/creative/agents.ts:55`** interpolates untrusted external ad copy raw: `` `Ad copy:\n${ctx.copyText}${upstream}` `` (competitor Ad Library copy = attacker-controllable). No `compose()`.
- **P2 — `lib/brand/profile.ts:48-53,76-94`** interpolates `adNames`/`adCopy` raw into the prompt. No `compose()`.
  Blast radius is limited by `stringObjectSchema` (constrained JSON out), but steering is still possible. Inconsistent with decode.ts (same data, fenced).

---

## 7. MATCH / DRIFT vs docs/ai-audit-architecture.md

- **MATCH:** deterministic-decisions-AI-narrates (judgment); hierarchical/compact context (§71); anti-hallucination intent for Ask (verifier exists).
- **DRIFT:** doc claims regulatory-grade "every recommendation traces to data / withhold rather than fabricate" (:125-127). Live: the enforcing validator (strategist + validateStrategistOutput) is unwired; positioning/concepts have no number verifier; two prompt sites are unfenced; vision path escapes global cost/kill guards.
- **UNKNOWN:** `deriveJSON` (site 10) per-caller grounding/caps not audited in this pass; whether prod actually sets `AI_DAILY_COST_BUDGET` (env not readable here).
