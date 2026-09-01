# The Output Contract (§110) — one shape for every decision AdBrain makes

_Canonical doc. The Output Contract is the code form of the founder's reasoning chain (Build-Loop rule #3):
every decision-grade output walks **DATA → TRUST → SIGNAL → DIAGNOSIS → ECONOMIC IMPACT → 2nd-ORDER →
3rd-ORDER → DECISION → ACTION → OUTCOME → LEARNING**, and can never skip from DATA straight to a DECISION._

## Why it exists

A media buyer trusts a tool only when every call carries its reasoning and its honesty. Before this, each
engine (fatigue, bleed, funnel, …) reasoned in its own silo and there was no single shape guaranteeing that a
recommendation stated its money impact, its second-order effect, and what could make it wrong. The contract
makes those guarantees **structural** — enforced in code and in the `check:all` gate, not left to discipline.

## The core law (enforced, not advisory)

`lib/intelligence/output-contract.ts`:

- **`hold(...)`** — the data can't be trusted enough to decide (too little spend/volume, stale, no fair
  baseline). Produces a contract with **no decision and no action**, stating the honest reason + what to
  connect/wait for. This is the app being "comfortable saying HOLD" (charter §5).
- **`decide(...)`** — the data is trusted; assembles a full decided contract. It **throws** (caught by the
  gate) unless the decision carries its **economic impact (₹)**, its **second-order effect**, its
  **diagnosis**, and **what-could-be-wrong**. So a decision without its reasoning fails in tests, never in
  front of a user.
- **`validateOutput(c)`** — the deterministic invariant checker. The load-bearing rule: **a DECISION while
  TRUST failed is invalid** (never jump DATA → DECISION).
- **`headline(c)`** — one plain-English line for a card (§121: translate, don't dump z-scores).

A raw metric tile does **not** use this — only outputs that recommend or conclude something.

## Adapters (engine output → contract)

Each adapter is a **new file** that maps a live engine's real output into the contract **without editing the
engine** (multi-chat protocol: new files, no hot-file churn). Each has a `check:*-contract` gate.

| Engine | Adapter | Gate | Notes |
|---|---|---|---|
| Money-bleed / culprit (`lib/scoring/culprit.ts`) | `lib/intelligence/from-culprit.ts` | `check:culprit-contract` | Names a paused/ended entity only as the CAUSE, never as a live thing to fix (liveness rule). |
| Creative fatigue (`lib/cockpit/analyze.ts`) | `lib/intelligence/from-fatigue.ts` | `check:fatigue-contract` | Sales-family ad under 50 conversions → HOLD. Stopped ad → null. |
| Funnel diagnosis (`lib/funnel/diagnosis.ts`) | `lib/intelligence/from-funnel.ts` | `check:funnel-contract` | Uses the engine's own `hold` reason; names the weakest step vs own-best same-objective ad. |
| Winner scores (`lib/scoring/winner.ts`) | `lib/intelligence/from-winner.ts` | `check:winner-contract` | §37 taxonomy (PROVEN/EMERGING/FRAGILE/EFFICIENT-LOW-SCALE) from the four sub-reads. Too little proven spend → HOLD (§95). |
| Creative diversity (`lib/creative/diversity.ts`) | `lib/intelligence/from-diversity.ts` | `check:diversity-contract` | §36 fragility: ≥60% spend in one bucket → Diversify, sized in ₹. Low semantic coverage → HOLD. |

**Cross-adapter safety:** `scripts/check-contract-invariants.ts` (`check:contract-invariants`) runs representative
outputs from every adapter + both hold/decide paths through `validateOutput` and asserts the universal law —
so a future adapter that breaks the chain fails the gate.

## Where it renders (visible today)

| Surface | Component | What it shows |
|---|---|---|
| Home cockpit — "Why results dropped" | `components/cockpit/CulpritBanner.tsx` | The bleed contract's full reasoning under the one-liner. |
| Home cockpit — "This week's ranked plan" | `components/cockpit/ActionList.tsx` | The reasoning behind each ranked action (the main decision surface). |
| Funnel report — each ad card | `components/app/funnel/funnel-report.tsx` | The funnel contract behind each ad's weakest step or hold. |

Rendering uses the shared `components/intelligence/ReasoningTrace.tsx` — a server component (native
`<details>`, no client JS) that shows only the stages that exist, in chain order.

## Rules for adding an adapter

1. New file `lib/intelligence/from-<engine>.ts`; **import the engine's types only** (`import type`), never edit it.
2. Value imports inside a file run by a `check:*` script must be **relative** (`../rules/x.ts`), not `@/…`
   (the `@/` alias is not resolved by `node --experimental-strip-types` for value imports).
3. Return `null` when there is nothing to surface; `hold(...)` when data can't be trusted; `decide(...)`
   otherwise — and let `decide()`/`validateOutput()` enforce the chain.
4. Add a `scripts/check-<engine>-contract.ts` with fixtures for: null, HOLD, and a full decided case; wire it
   into `check:all` in `package.json`.

## Not yet done (honest)

- Adapters for scaling elasticity (§47–48) and account health decomposition (§22) — the pattern is set; each
  is a new file + gate + optional render.
- Uniform adoption across every recommendation surface — three surfaces render it today (bleed banner, ranked
  plan, funnel cards); the rest (health card, winners/diversity tabs) adopt it as they are next touched.
- None of the renders are live-verified on a real account yet (they need the founder's logged-in session);
  they are code + build + gate verified.
