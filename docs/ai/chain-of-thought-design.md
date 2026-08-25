# Chain-of-Thought Design — AdBrain AI agents

For the Gemini agents in `docs/agents/agent-roles.md`. The governing constraint: the AI
narrates and classifies; it never computes the numbers (the rules engine does), and every
claim must cite evidence (the Validator vetoes uncited/fabricated output).

## The load-bearing principle
**"Show the working" is the deterministic rule computation (source → formula → reason),
NOT the model's chain of thought.** A CoT can be convincingly wrong; shipping it as the
justification would manufacture false trust — the opposite of the product's promise. So:
- The model reasons **internally** (a scratchpad), then emits **only** a schema-validated result.
- User-facing trust comes from the rules + cited evidence, which the Validator checks against
  the output. We never surface the CoT to the user as proof.

## Per-agent chains

### Deconstructor — LINEAR (<=4 steps), depth-capped
Input: one creative (image/video) + copy. Output: attributes + candidate triples.
1. **Observe:** list only what is literally present (hook style, on-screen text, format, who/what
   is shown). No performance inference.
2. **Classify:** map observations to the taxonomy (hook type, angle, format, emotional driver,
   claim structure).
3. **Flag uncertainty:** mark any classification below ~0.6 confidence.
4. **Emit:** `{subject, predicate, object, confidence}[]`. Reasoning stays OUT of the JSON.
Guard: describe, do not judge — it has no metrics here, so it must not assert "this works."

### Strategist / Verdict — BRANCHING, grounded in provided numbers
Input: the brand's triples + the rules-engine numbers (fatigue, waste, ROAS, money impact).
1. **Branch:** for each ad/cluster, consider the candidate moves scale / stop / continue.
2. **Evidence per branch:** gather support/refute ONLY from provided triples + rule numbers
   (cite `evidence_triple_ids` and the rule value).
3. **Evaluate:** compare branches using the PROVIDED money numbers — never compute a new figure.
4. **Choose + rank:** pick one move per ad; rank across ads by the rule-provided money impact.
5. **Emit:** `{kind, outcome, rationale, money_impact(=rule value), confidence, evidence_triple_ids}`.
Guard: if a needed number is not in the inputs, output `insufficient_data` — do not estimate.

### Explainer — NO CHAIN (deliberate)
Input: `{number, source, formula, inputs}`. Output: the drawer's 5 rows in plain language.
It restates provided facts; it does not reason to new conclusions. A chain here would only
invite drift. Guard: introduce NO new figure; a missing field renders "source unavailable."

### Concept — ITERATIVE (draft → critique → revise, 1 pass)
1. **Draft:** from a cited winner + a cited competitor gap, draft one concept.
2. **Critique:** does it fill the gap? is it shoot-able? is every part sourced?
3. **Revise:** fix, attach source weights.
4. **Emit:** recipe parts `{sku, format, concept, offer, landing}` with sources.

### Validator — DEBATE / CRITIQUE, fail-closed
For each shipped item: argue "verifiable" (every figure traces to a rule/evidence) vs
"not verifiable," then decide pass or `cannot_verify`. On error or doubt → withhold.

## Chain-variant selection

| Task type | Agent | Variant | Why |
|---|---|---|---|
| Analytical extraction | Deconstructor | Linear | fixed steps, predictable |
| Decision | Strategist | Branching | weigh scale/stop/continue |
| Narration | Explainer | None | avoid convincing-but-wrong drift |
| Creative | Concept | Iterative | draft-critique lifts quality |
| Verification | Validator | Debate | argue both sides, fail closed |

## Depth limits (control cost + runaway on Gemini free tier)
- Deconstructor: <=4 steps, one ad at a time.
- Strategist: <=3 branches per ad; only the top-N ads by rule impact.
- Concept: exactly 1 critique pass.
- All chains: reason internally, emit compact JSON. No visible rambling.

## Quality checkpoints (validate intermediate steps, not just the answer)
- Every triple / recommendation carries a citation; uncited items are dropped by the Validator.
- Any number in the output must byte-match a provided rule value (Validator diff) — no new numbers.
- Final output is schema-validated; on failure, retry once with a stricter instruction, then skip.
- Forecasts are labeled estimates with their inputs; never stated as facts.

## Good vs poor chain (Strategist)
- **Poor:** "Think step by step about what to do, then recommend." → the model invents
  "ROAS should improve ~15%" with fluent reasoning. Fabricated number, false confidence, ships trust
  it did not earn.
- **Good:** "Using ONLY the provided metrics and triples (cite ids), for each ad consider
  scale/stop/continue, pick one, and set `money_impact` by copying the provided rule value. If a
  value is missing, output `insufficient_data`. Reason internally; output only the JSON schema."
  → grounded, auditable, Validator-checkable.
