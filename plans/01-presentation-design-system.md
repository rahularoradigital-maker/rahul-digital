# [plan-01] Presentation-Layer Design System — one enforced token system + finished states + a11y floor

## Defect

The cockpit's information architecture and data path are strong, but the presentation layer has
**no enforced design system**: spacing, type, and radius are each expressed three or four ways,
decorative chrome accretes because nothing enforces "less", and the six UI states plus the
accessibility floor were never finished. A Dieter Rams audit scored it **15/30 (REDESIGN)** with
1-scores in aesthetic, understandable, honest, thorough, and little-design — five symptoms, one
root cause. Patching one card cannot fix a missing system; it moves the inconsistency around.

## Symptoms (would all be retired by one design-system pass)

- Card padding spans 16/20/22/24px; 8 of 12 type sizes are bespoke `text-[Npx]` (dup 20px);
  pill radius in 3 idioms; `--radius-card` defined but unused. (Visual audit §1,2,4)
- `insufficient_data` snake_case leaked to the UI *(fixed 2026-08-27)*; MER/nCAC/Concentration
  jargon needs plain labels. (Copy audit §4)
- Decorative/dishonest chrome: "Adam · Ranker" badge, dual "Live", non-functional "Ask" box
  *(all fixed 2026-08-27)*; two permanently-dead MER/nCAC KPI cards remain. (Copy §2,5)
- `--accent` failed 4.5:1 as text *(fixed → #0a66c2)*; focus rings missing on most controls
  (AdLink + Ask fixed; the switchers/buttons still rely on UA default). (A11y §2)
- No `error.tsx` boundary; no success confirmation on Re-scan/date change; disabled opacity
  inconsistent (40/50/60). (Visual §5)
- Dropdowns do not close on `Escape`; no skip-link; two `<nav>` landmarks unlabeled. (A11y §3,4,5)

## Fix sequence

1. Author the token system in `app/globals.css`: one spacing scale, one type ramp, one radius
   rule, `--accent-ink` for text; document a "no arbitrary `text-[Npx]`/`p-[Npx]`/`rounded-[Npx]`"
   rule. (Preserve the 14-color palette — its *usage* was the problem, not the values.)
2. Migrate `app/app/page.tsx` + `components/cockpit/*` + `topbar`/switchers to the tokens, one
   file per task.
3. Finish states: add `app/app/error.tsx`, a success confirmation surface, one disabled opacity.
4. A11y floor: focus-visible ring on every control; `Escape`-to-close on the four dropdowns;
   skip-link in `app/app/layout.tsx`; `aria-label` the two nav landmarks.
5. Honest chrome cleanup: collapse the two dead MER/nCAC KPI cards into one "Connect Shopify to
   unlock" affordance (ties to plan-04).

## Test matrix

| Surface | Light | Dark | Keyboard-only | Reduced-motion |
|---|---|---|---|---|
| Cockpit (connected) | tokens only, states present | same | focus visible on every control, Escape closes dropdowns, skip-link reaches main | no idle motion |
| Connect / error / empty | designed, not default-browser | same | reachable | — |

Add a lint/CI check that fails on arbitrary `-[Npx]` values in `components/` so the system cannot drift.

## Out of scope

Information architecture (keep the 10-section flow), the server-rendered data path, and the
scoring engines. Ready handoff: `../DESIGN-IS-2026-08-27/04-handoff-prompt.md`.
