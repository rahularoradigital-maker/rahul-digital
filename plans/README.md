# AdBrain plans — the roadmap

The unit of work is the **architectural defect**, not the symptom. Each plan below retires a
whole family of symptoms with one bounded set of changes and a test matrix that keeps it fixed.

> Note: this repo has no GitHub issue tracker in the workflow (solo, manual push, `gh` not
> installed). These plans are the canonical backlog. When an issue tracker is added, each plan
> becomes a `[plan-0X]` master and its "Symptoms" become child issues that redirect to it.

| Plan | Architectural defect | Status |
|---|---|---|
| [plan-01](01-presentation-design-system.md) | Presentation layer has no enforced design system (Rams audit: 15/30, REDESIGN) | not started |
| [plan-02](02-engine-consolidation.md) | Two parallel engine families — no single source of truth per concern | not started |
| [plan-03](03-ingestion-serving-tier.md) | Data is fetched live per request — no sync/cache/rollup tier | seams stubbed |
| [plan-04](04-revenue-connectors.md) | Revenue-blind economics — MER/nCAC/contribution permanently gated | seam built |
| [plan-05](05-own-ad-creative-intelligence.md) | Own-ad creative intelligence not wired (fingerprint-once idle) | engines built |

## Priority read

- **plan-01** is the biggest user-visible quality lever and already has a ready `/make-plan`
  handoff (`../DESIGN-IS-2026-08-27/04-handoff-prompt.md`).
- **plan-02** should precede large new feature work — building on the leaner engine set while
  the fuller spec-driven set sits half-wired compounds drift.
- **plan-03/04/05** are the "make it real" tier: scale, true economics, and own-creative intel.
