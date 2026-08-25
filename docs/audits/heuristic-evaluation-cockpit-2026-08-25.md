# Heuristic Evaluation — AdBrain Cockpit — 2026-08-25

Scope: the cockpit design as it exists — `docs/mockups/cockpit-v1.html` + the interaction
spec (`docs/ux/cockpit-interaction-spec.md`) + the states table (cockpit spec §5). Severity:
0 cosmetic, 1 minor, 2 moderate, 3 major, 4 catastrophe (Nielsen scale).

## Findings per heuristic

1. **Visibility of system status** — Strong: live status, sync progress, decision tally,
   confidence-that-rises. *Finding (1):* the mockup shows only the loaded state; ensure the
   real app makes the pull/loading skeleton prominent (spec §5 covers it).
2. **Match to the real world** — *Finding (3, major):* the verdict is plain, but section
   internals use media-buyer jargon (half-life, SOV, "8 real options", CPM) that our FIRST
   segment (non-technical in-house D2C) may not parse. Mismatch with the target user.
3. **User control & freedom** — Strong: approve/deny/snooze + Undo + "nothing launches on its
   own." *Finding (2):* undo of an *applied* change (vs a staged one) is unspecified — History
   has "replay" but reversing a live change is unclear.
4. **Consistency & standards** — Strong: DESIGN.md enforces one system; conventions (top nav,
   cards, mono numerals) used well. No finding.
5. **Error prevention** — Strong highlight: typed-CONFIRM Apply gate, stage-vs-apply,
   manual-apply default. *Finding (1):* denying a high-value "scale" rec has no light confirm;
   a mis-click could cost upside.
6. **Recognition over recall** — Good: everything on screen; "show the working" removes recall.
   *Finding (1):* mobile section nav (horizontal scroll strip) can hide sections.
7. **Flexibility & efficiency** — Good: A/D/S shortcuts, batch approve. *Finding (1):* no saved
   views/filter persistence.
8. **Aesthetic & minimalist** — Strong per section (warm paper, one honest number). *Finding
   (2, moderate):* nine dense sections on one scroll is a lot; minimalism per section does not
   fix the overall length. Works against "don't make me think."
9. **Recognize/diagnose/recover from errors** — Strong: per-row errors, "cannot verify",
   reconnect prompts (spec §5). No new finding.
10. **Help & documentation** — Excellent differentiator: the "show the working" drawer IS
    contextual help. *Finding (2):* no first-run guidance for a newcomer facing a dense cockpit.

## Flow analysis (connect → decide → apply)
- *Finding (3, major):* the first-run transition is a cliff — empty state → pull (minutes) →
  suddenly a 9-section cockpit. There is no guided "here are your 3 moves today" landing before
  the full surface. (Echoes the opportunity analysis and design review.)
- *Finding (1):* the verdict says "shoot 3 concepts" but Concepts is section 10, far below;
  proximity gap between the call and the place to act on it.

## Accessibility check (against the mockup + DESIGN a11y floor)
- *Finding (3, major):* the mockup uses 9-11px mono labels — below DESIGN.md's own 12.5px floor.
  Size + contrast risk. The reference does this too; do not inherit it.
- *Finding (2):* low-contrast greys on the dark bar (#8A8879 on #17170F) are borderline (~4:1);
  verify against 4.5:1.
- *Finding (2):* the mockup has no semantic landmarks or heading hierarchy (section titles are
  `<div>`, not `<h2>`); real build must use them (interaction spec requires it).
- *Finding (2):* no visible focus styles in the mockup; build must add ≥2px focus rings.
- Positive: status is color dot + text label (never color alone) ✓; buttons are real `<button>` ✓.

## Prioritized recommendations
1. **[P1] Lead with "3 moves today" before the full cockpit** — a guided first view every run,
   with the nine sections as progressive/collapsible depth. Fixes the first-run cliff (Flow-major)
   and the density issue (H8), and matches the opportunity analysis. Highest leverage.
2. **[P1] Plain-language pass** — gloss or tooltip buyer jargon (half-life, SOV, diversity) since
   the first segment is non-technical. Fixes H2-major.
3. **[P1] Meet your own a11y floor** — raise sub-12.5px labels, re-check the borderline greys.
4. **[P2] Real build must ship semantic headings/landmarks + visible focus rings** (spec already
   requires; the mockup omits them — make sure they actually land).
5. **[P2] Specify reversal of an *applied* change** and a light confirm on denying a high-value
   scale rec.

## Note
Two majors here (first-run cliff, jargon-vs-non-technical-user) reinforce findings from the
plan-design-review and the feature opportunity analysis. That is convergence, not repetition:
the same tension (a big dense cockpit vs a non-technical first user) keeps surfacing. Worth a
real-user test (`/test-plan`) once the core is built.
