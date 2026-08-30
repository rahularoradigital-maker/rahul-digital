# Plan: Whole-App AI Model Routing (light model for light tasks, best model for high-end tasks)

**Context.** OpenAI, Anthropic (Claude), Google Gemini, and ScrapeCreators keys are now in the
environment with credits. Goal: route each AI task in AdBrain to the *right* model — the cheapest
model that does the job well for high-volume/simple work, the strongest model for the few tasks
where quality or judgment is the product. Build one provider-agnostic router so the model behind any
task is a config change, never a code change, with automatic fallback across providers.

Grounded in code (Phase 0 discovery). No model IDs are invented here — the tier *intent* is fixed;
**exact current model IDs + prices must be confirmed from each provider's docs at wiring time** (see
anti-patterns). Today the app uses only Gemini via `lib/gemini.ts` (`callGemini` vision =
`gemini-3.6-flash`; `callGeminiText` = `gemini-flash-lite-latest`).

---

## Phase 0 — Discovery (done)

AI call sites and their nature:

| App part | File | Call | Nature |
|---|---|---|---|
| Creative vision analysis (agent chain) | `lib/agents/creative/agents.ts:55` | `callGemini` (vision) | High VOLUME multimodal (dozens of creatives/run), structured extraction |
| Brand profiling + competitor extraction | `lib/brand/profile.ts:67,94` | `callGemini` (vision) | Vision + light reasoning |
| Concept / strategy generation | `lib/creative-production/intelligence/llm-json.ts:8` | `callGeminiText` | Creative reasoning — QUALITY matters (this is the product) |
| Ask Q&A (grounded) | `app/api/ask/route.ts:95,105` | `callGeminiText` | High volume, grounded over data |
| Positioning (ICP + pillars) | `app/api/market/positioning/route.ts:89` | `callGeminiText` | Synthesis over data |
| Creative analyze (text) | `app/api/creative/analyze/route.ts:96` | `callGeminiText` | Explain/summarize |
| Image generation | `lib/creative-production/providers/google-gemini.ts` | image API (`IMAGE_PROVIDER`/`IMAGE_MODEL`) | Nano Banana; provider-driven |
| Influencer scoring | `lib/influencer/scoring/*` | **none** | **Deterministic formulas — DO NOT put an LLM here** |
| Competitor data | ScrapeCreators + Meta Ad Library | **none** | Data fetch, not a model |

**Anti-patterns already avoided:** influencer scoring and the rules/decision math are deterministic
by design — keep them out of the LLM path (transparency + cost). ScrapeCreators/Meta are data, not
models.

---

## The routing map (which part → which model)

Tier intent is fixed; pick the concrete model per provider from the tier table below.

| # | Task | Load | Tier | Primary (recommended) | Fallback order | Why |
|---|---|---|---|---|---|---|
| 1 | Ask Q&A | High volume | **Light** | Gemini flash-lite | GPT light -> Claude Haiku | Cheap, fast, grounded answers |
| 2 | Creative analyze (text) | Medium | **Light** | Gemini flash-lite | GPT light | Summarize/explain, low stakes |
| 3 | Positioning | Medium | **Standard** | Gemini flash | Claude Sonnet | Better synthesis over data |
| 4 | Creative vision analysis (agents) | Very high volume | **Vision-volume** | Gemini flash (multimodal) | GPT light-vision | Volume + cost + best free/quota multimodal |
| 5 | Brand profiling / competitor extract | Medium | **Standard-vision** | Gemini flash | Claude Sonnet (vision) | Balance vision + reasoning |
| 6 | Concept / strategy generation | Low volume, high value | **Heavy** | Claude Sonnet (or GPT top) | Gemini flash | Creative quality = the product |
| 7 | Decision verdict / judge (cockpit) | Low volume, high stakes | **Heavy** | Claude Sonnet / GPT top | Gemini flash | Correctness of the "scale/kill" call |
| 8 | Image generation | Per-creative | **Image** | Gemini image (Nano Banana) | GPT-Image / DALL-E | Quality + cost |
| 9 | Video generation (future) | Per-video | **Video** | Google Veo | Seedance | One Gemini key already covers Veo |
| 10 | Influencer scoring | High volume | **Deterministic** | none (formula) | — | Keep transparent + free |

**The rule in one line:** default everything to the **light** tier; escalate to **heavy** only for
tasks 6 and 7 (creative generation strategy + the final decision verdict), and use the multimodal
**flash** tier for the high-volume vision work (task 4) because Gemini's quota/cost win there.

## Tier -> concrete model per provider (confirm exact IDs at wiring time)

| Tier | Gemini | OpenAI | Anthropic |
|---|---|---|---|
| Light | flash-lite (current) | GPT light/mini | Claude Haiku |
| Standard | flash | GPT standard | Claude Sonnet |
| Heavy | pro | GPT top | Claude Opus / Sonnet |
| Vision (volume) | flash (multimodal) | GPT light-vision | Claude Sonnet (vision) |
| Image | Nano Banana (gemini image) | GPT-Image / DALL-E | (n/a) |
| Video | Veo | (n/a) | (n/a) |

---

## Phase 1 — Provider-agnostic AI router (new `lib/ai/`)

**What to implement (copy the existing Gemini call shape, do not rewrite it):**
- `lib/ai/tasks.ts` — a `TaskKind` union: `"ask" | "analyze-text" | "positioning" | "concept-gen" |
  "creative-vision" | "brand-profile" | "decision-verdict"`, and a `Tier` union.
- `lib/ai/config.ts` — a map `TaskKind -> { tier, primary: {provider, model}, fallbacks: [{provider, model}] }`,
  every field overridable by an env var (e.g. `AI_MODEL_ASK`, `AI_MODEL_CONCEPT_GEN`) so a model swap
  is config-only. Default the map exactly to the routing table above.
- `lib/ai/router.ts` — one function `runTask(kind, { prompt, schema, inline? })` that reads the config,
  calls the primary provider adapter, and on `null`/error walks the `fallbacks`. Reuse `callGemini` /
  `callGeminiText` / `stringObjectSchema` from `lib/gemini.ts:covering vision + text` verbatim for the
  Gemini adapter.

**Verification:** unit self-check `scripts/check-ai-router.ts` (assert config has an entry for every
`TaskKind`, every task has >=1 fallback, deterministic tasks are NOT in the map). Wire into `check:all`.

**Anti-pattern guards:** do NOT change `lib/gemini.ts` internals; wrap it. Do NOT add a model ID that
isn't confirmed from provider docs. Do NOT route influencer scoring or the rules engine through this.

## Phase 2 — Provider adapters (Gemini wrap + OpenAI + Anthropic)

**What to implement (copy each provider's documented JSON/structured-output call):**
- `lib/ai/providers/gemini.ts` — thin wrapper over existing `callGemini`/`callGeminiText`.
- `lib/ai/providers/openai.ts` — read `OPENAI_API_KEY`; use the provider's documented Chat Completions /
  Responses API with JSON/structured output; return the same `Record<string,unknown> | null` contract.
- `lib/ai/providers/anthropic.ts` — read `ANTHROPIC_API_KEY`; use the documented Messages API with a
  tool/JSON output; same return contract. Header auth, server-only, `null` on any failure (match
  `lib/gemini.ts` failure isolation).

**Documentation references (READ before writing — do not assume signatures):**
- OpenAI: platform.openai.com/docs (structured outputs / JSON schema).
- Anthropic: docs.anthropic.com (Messages API + tool use / JSON).
- Confirm the exact current model IDs + per-token/image prices on each console at this step.

**Verification:** a live smoke `scripts/smoke-ai-providers.mjs` that runs one tiny structured call per
provider (guarded so it no-ops when a key is missing) and asserts a valid parsed object back.

**Anti-pattern guards:** no invented params; server-only; never log or return raw keys; identical
output contract across providers so the router can swap freely.

## Phase 3 — Migrate every call site to the router (one task at a time)

Replace each direct call with `runTask(kind, ...)`, preserving behavior:
- `app/api/ask/route.ts` -> `runTask("ask", ...)`
- `app/api/market/positioning/route.ts` -> `runTask("positioning", ...)`
- `app/api/creative/analyze/route.ts` -> `runTask("analyze-text", ...)`
- `lib/creative-production/intelligence/llm-json.ts` -> `runTask("concept-gen", ...)`
- `lib/agents/creative/agents.ts` -> `runTask("creative-vision", ..., inline)`
- `lib/brand/profile.ts` -> `runTask("brand-profile", ...)`
- (new) decision verdict path -> `runTask("decision-verdict", ...)` when that call exists.

**Verification:** `grep -rn "callGemini(" app lib` returns only the Gemini adapter + `lib/gemini.ts`
(no direct calls left outside `lib/ai/`). Each migrated route/module behaves identically on a smoke run.

**Anti-pattern guards:** migrate + verify ONE task before the next; do not change prompts or schemas
during migration (behavior-preserving move only).

## Phase 4 — Assign models, per-task env overrides, cost + budget

- Set the default config to the routing table (light everywhere; heavy only for concept-gen +
  decision-verdict; flash for creative-vision).
- Add `AI_MODEL_<TASK>` + `AI_PROVIDER_<TASK>` env overrides so you can A/B a model per task with no deploy.
- Add per-call cost logging keyed by `TaskKind` + provider + model (extend the existing pricing table
  `lib/creative-production/providers/pricing.ts`), and a **per-tenant daily AI budget cap** that fails
  soft (falls back to the lighter model, then refuses) so one account can't blow the bill.

**Verification:** `scripts/check-ai-budget.ts` asserts the cap enforces; a dashboard/log line shows
$/task/tenant.

**Anti-pattern guards:** never hard-fail a user action on budget — degrade to lighter model first.

## Phase 5 — Final verification

1. Every `TaskKind` has a primary + fallback; every AI call site goes through `runTask`.
2. `grep` shows no direct provider calls outside `lib/ai/providers/*` and `lib/gemini.ts`.
3. Live smoke: each provider returns a valid structured object; fallback triggers when the primary
   is forced to fail.
4. Deterministic tasks (influencer scoring, rules engine) untouched — `grep` confirms no LLM added.
5. `npm run check:all` green; cost log emits per task/provider/model.

---

## Cost principle (the whole point)

- **Light tier is the default.** ~80% of calls (Ask, analyze, most vision) run on the cheapest model.
- **Heavy tier is rationed** to the two tasks where quality is the product: concept/strategy
  generation and the final scale/refresh/kill verdict.
- **Gemini stays primary for volume + vision** (best quota/cost, one key also does image + video).
- **OpenAI / Claude are the fallback + the quality escalation** for the heavy tasks, and insurance
  when Gemini rate-limits (429/503) — which the code already hits.
