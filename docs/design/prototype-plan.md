# AdBrain — Prototyping & Testing Plan

Tests the UX/design (usable? understood? trusted?). Complements the validation plan
(`docs/superpowers/specs/2026-08-25-validation-approach-design.md`), which tests whether the
recommendations are *correct*. Overlap: the concierge test runs on this prototype.

## 1. Strategy & fidelity
- **We already have a hi-fi prototype:** `docs/design/*.dc.html` — landing, product, book-demo, and
  the 11-screen Dashboard (client-side router). No new low-fi wireframing needed.
- **Fidelity rationale: HIGH.** AdBrain's value is the *intelligence and decisions*, which only
  read as real with realistic content. A grey-box wireframe can't test "do I trust this verdict?"
  So we test the hi-fi artboard **seeded with realistic (ideally a real account's) data.**
- **Method:** moderated + unmoderated usability tests on the seeded artboard; the concierge test
  (validation plan) doubles as the highest-signal moderated session.

## 2. Flows to prototype (the spine)
Connect account → data pull (progress) → **Cockpit verdict + health ring** → **Do-this queue**
(approve/deny) → **Show-the-working drawer** → **Review & Apply** (confirm). Plus: Creative Fatigue,
Budget & Scaling (marginal ROAS), Competitors. All exist in the Dashboard artboard.

## 3. Wireframe status
Specified by the artboards + `DESIGN.md` + `pattern-library.md`. The one gap to add before testing,
from the heuristic/ability audits: a **"3 moves today" landing** at the top of the cockpit
(progressive disclosure) so a first-run non-technical owner isn't dropped into 11 dense sections.

## 4. Test scenarios (measure behavior, not opinion)
| # | Task | Tests | Success threshold |
|---|---|---|---|
| 1 | "You just opened AdBrain. In 30s, what does it want you to do first?" | A9 comprehension / "3 moves" | names the top action/verdict unaided |
| 2 | "Handle today's recommendations." | H3 (act) | approves/denies >=1 without help; explains the money impact |
| 3 | "You're about to stop a Rs 500/day ad — convince yourself it's right." | H4 (trust via show-the-working) | opens the drawer, finds source+formula+reason unaided |
| 4 | "You have Rs 10L more to spend. Where does it go?" | decision utility | finds Budget & Scaling, reads marginal ROAS |
| 5 | Point at "hold rate" / "diversity score" | A9 jargon / cognitive breakpoint | understands, or the hover explains it clearly |

Run with 5 participants (Nielsen: 5 finds ~85% of issues), ideally real DTC media buyers/owners.

## 5. Accessibility test plan (per the WCAG audit)
- **Keyboard-only:** tab through the do-this queue; approve/deny via Enter + A/D/S; drawer opens on
  Enter, Esc closes, focus returns. No trap escapes.
- **Screen reader (VoiceOver/NVDA):** verdict read as text; health ring announces "57 of 100";
  sparklines have text equivalents; ad images use the Deconstructor's alt text; toggles announce state.
- **Contrast/size:** verify telli tokens (ochre-text fix applied; accent-blue only for large text/UI);
  44px targets; visible focus rings.
- Tools: axe automated pass + one manual screen-reader run.

## 6. Timeline (event-driven, tied to validation)
- **Now:** artboards ready. Add the "3 moves" landing + apply the a11y fixes (ochre, alt-text, focus).
- **On Meta connect (your action):** seed the prototype with a real account → run the rules backtest
  (validation V1) in parallel.
- **Days 1-5 after seed:** 5 usability sessions (2 moderated incl. the concierge, 3 unmoderated) +
  the a11y pass.
- **Day 5-7:** synthesize findings → feed into the Phase 2 build and the design.

## Next
Follow with `/test-plan` for the detailed usability protocol, or `/evaluate` for another expert pass.
The gating dependency is the same as everything else: a connected Meta account for real seed data.
