# Context Engineering — AdBrain AI agents

How we fill each Gemini call's context window. Governing facts: the Brand Brain
(`triples`) grows unbounded, Gemini free tier is rate-limited, and the CoT design requires
the model to COPY rules-engine numbers (never invent them). So context is selected, ordered,
and cached deliberately.

## Two anchoring decisions
- **Structured retrieval, not vector RAG.** Triples have keys (subject/predicate/object,
  brand_id, confidence, source). We select context with a Postgres query, not embeddings. No
  vector DB at MVP (fits D3). Simpler, cheaper, exact.
- **Authoritative numbers go adjacent to the task.** The rules-engine values the Strategist must
  copy sit right before the ask, in the high-attention zone, never mid-context where they get lost.

## Context budget per agent (rough allocation)

| Agent | System/guardrails | Retrieved context | Task + schema | Notes |
|---|---|---|---|---|
| Deconstructor | ~15% | ~70% (the creative: image/video is the cost) | ~15% | one ad only; no graph |
| Strategist | ~15% | ~65% (rules numbers + selected triples + brand profile) | ~20% | the RAG-heavy agent |
| Explainer | ~30% | ~40% (only the one number's source/formula/inputs) | ~30% | deliberately minimal |
| Concept | ~15% | ~65% (cited winner + competitor gap + niche patterns) | ~20% | |
| Validator | ~25% | ~50% (the item + the evidence it cites) | ~25% | checks citations resolve |

## Information architecture (order, per call)
1. **Beginning (high attention):** role + guardrails ("narrate, never compute; cite everything;
   missing value → insufficient_data") + brand profile (niche, objectives, spend floor).
2. **Middle:** the selected triples / supporting evidence.
3. **Adjacent to the task (high attention):** the authoritative rules-engine numbers the model
   must copy, immediately followed by the ask and the output schema.
4. **End:** the JSON schema and "reason internally, output only the schema."

## Selection criteria (what gets in)
- **Relevance:** triples touching the ads in scope or this niche; drop unrelated brands/niches.
- **Recency:** latest synced metrics; prefer recent triples but keep durable high-confidence ones.
- **Specificity:** specific triples over generic; a per-ad fact beats a vague pattern.
- **Redundancy:** the Curator guarantees unique triples; never repeat the brand profile.
- **Authority:** rules-engine numbers are authoritative (copied verbatim); triples carry a
  confidence; competitor data is lowest authority (labeled as such).

## Retrieval strategy (the Brand Brain query)
For a Strategist run over the top-N ads by rule impact:
1. Triples **directly about those ads** (`source_id in (...)` or subject/object matches the ad).
2. Plus **top-K niche winners/losers** by `confidence * recency` for the brand.
3. Cap at a fixed K (tune to Gemini limits); log what was dropped (no silent truncation).
Pure SQL over `triples` + `ad_metrics`. If K ever proves too blunt, add ranking, not a vector DB.

## Context caching (big free-tier saver)
The stable prefix — guardrails + brand profile + the deconstruction taxonomy — is identical
across the MANY per-ad Deconstructor calls and per-run Strategist calls. Cache it (Gemini
context/prefix caching) so only the variable part (this ad, these numbers) is re-sent. This is
the main cost lever given one call per ad.

## Quality signals to monitor
- **Hallucination rate:** any output number not matching a provided rule value → Validator catches
  it; track the catch rate (should trend to zero as prompts tighten).
- **Context utilisation:** do recommendations actually cite the retrieved triples? Uncited = the
  retrieval or the prompt is off.
- **Consistency:** same inputs → same output (deterministic rules make this measurable).
- **Relevance:** does the output address the ads in scope, not drift to generic advice?

## Failure alignment
If retrieval returns thin context (new brand, few triples), agents must degrade to
`insufficient_data`, not fill the gap with generic guesses — same rule as the failure-recovery
and CoT designs. Context scarcity is an empty state, never a hallucination trigger.
