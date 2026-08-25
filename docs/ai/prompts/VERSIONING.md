# Prompt Versioning (prompts are code, lightly governed)

How AdBrain's agent prompts are versioned, tested, and rolled back. Kept lean per
`docs/GOVERNANCE.md`; integrates with the existing test-case discipline.

## Repository structure
- **Spec/package (human-facing):** `docs/ai/prompts/<agent>-vN.md` — the full package
  (prompt text, constraints, examples, test cases, version notes). Already: `strategist-v1.md`.
- **Runtime prompt (at build time):** `lib/prompts/<agent>.ts` exporting
  `{ version: "1.0", template }`. The app imports this; the doc is the source of truth for review.
- **Golden tests:** `scripts/prompt-tests/<agent>.mjs` — the agent's T-cases as runnable checks,
  wired to `npm run check:prompts`.
Prompts live in git, never in editable app config. Every change is a commit with a reason.

## Semantic versioning
- **MAJOR (x.0):** behavioral shift or output-schema change (e.g., new verdict logic, schema
  field added/removed). Requires full test suite + likely new golden cases + Rahul sign-off.
- **MINOR (x.y):** new capability that does not change existing behavior (e.g., a new rec kind).
  Requires regression + targeted tests.
- **PATCH (x.y.z):** wording/bug fix (e.g., plug a jargon leak, add a banned word). Regression only.

## Change categories
`bugfix` | `improvement` | `feature` | `experiment`. Experiments ship behind a flag
(`<AGENT>_PROMPT_VERSION` env/config) and never become default without passing the suite.

## Governance mapping (who approves what)
- **PATCH / bugfix** on wording → Tier 0: Claude edits, tests, commits. No approval.
- **MINOR / new capability** → Tier 1: Claude proposes, Rahul approves (it changes what users see).
- **MAJOR / behavioral shift** on a money-adjacent agent (Strategist, anything touching
  recommendations or numbers) → Tier 1, explicit approval, because it changes decisions users act on.
Never silently change a money-adjacent agent's behavior.

## Testing protocol per change type
| Change | Tests required |
|---|---|
| PATCH | Regression: full golden set (e.g. Strategist T1-T8) must still pass |
| MINOR | Regression + a targeted test for the new capability + related edge cases |
| MAJOR | Regression + targeted + edge + an offline eval on real-account samples (concierge/backtest) |
No prompt change deploys without its golden set green. "It reads better" is not a test.

## Deployment + rollback
- Runtime selects the version via a constant/flag (`<AGENT>_PROMPT_VERSION`), default = the
  latest green version.
- **Rollback:** point the flag back to the prior version (no deploy needed) or `git revert` the
  commit. Because the old version file stays in the repo, rollback is instant.
- No users yet, so "gradual rollout / production A-B" is N/A now; adopt percentage rollout once
  there are enough accounts to compare. Until then, validate offline against the golden set.

## Change-request template (paste into the commit body or a PR)
```
Prompt: <agent> vOLD -> vNEW
Category: bugfix | improvement | feature | experiment
What changed: <one line>
Why: <the problem or goal>
Behavioral impact: none | minor | MAJOR (money-adjacent? yes/no)
Tests run: <golden set result, e.g. Strategist T1-T8 green> + <targeted/edge if any>
Governance tier: 0 | 1  (1 = Rahul approved on <date>)
Rollback: set <AGENT>_PROMPT_VERSION=<old> or revert <commit>
```

## Common mistakes we explicitly avoid
- Untracked edits (prompts are in git, always).
- Untested changes (golden set gates every change).
- Big-bang edits (one behavioral change per version; if you touched five things, split them).
- Lost context (the version notes in each `<agent>-vN.md` say WHY the prior choices were made;
  read them before changing).

## Current registry
| Agent | Version | Status | Spec |
|---|---|---|---|
| Strategist | 1.0 | design-ready (not yet in code) | `strategist-v1.md` (tests T1-T8) |
| Deconstructor | - | templated in prompt-chain-spec, not packaged | - |
| Explainer | - | templated | - |
| Validator | - | templated | - |
