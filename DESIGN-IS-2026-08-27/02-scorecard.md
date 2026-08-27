# 02 — Scorecard (Dieter Rams, 10 principles)

Scored by the orchestrator against the Phase-2 anchors. Worst-instance, not mean. Ties break down.

**1. Good design is innovative — Score: 2/3**
   Evidence: reframes raw Meta tables into a "what to ship this week" decision surface with objective-aware scoring, fatigue forecast, marginal scaling (01-evidence/Structural §4).
   Justification: a clear improvement on an existing dashboard pattern, not a new form — anchor 2, not 3.

**2. Good design makes a product useful — Score: 2/3**
   Evidence: primary task (ship/kill/scale) is directly served by the ranked action list + health + leaderboard + deep links; but the always-dead MER/nCAC cards and a non-functional "Ask AdBrain" add decoy surface (Copy §5; Weight §5).
   Justification: task completes, but decoy actions on the same screen keep it off a 3.

**3. Good design is aesthetic — Score: 1/3**
   Evidence: card padding spans 16/20/22/24px; 8 of 12 type sizes are bespoke `text-[Npx]` (with a duplicate 20px); pill radius exists in three idioms and `--radius-card` is defined-but-unused (Visual §1,2,4).
   Justification: 3+ system inconsistencies across spacing, type and radius — anchor 1, not 2's "≤2 minor."

**4. Good design makes a product understandable — Score: 1/3**
   Evidence: verdict labels (Scale/Iterate/Hold/Kill) and the ranked plan are clear, but MER, nCAC, Concentration, Thumb-stop, Hold-rate all need tooltips and `insufficient_data` leaks snake_case to the UI (Copy §4).
   Justification: 3+ controls need a tooltip and jargon is present — anchor 1, not 2's "1 control needs a tooltip."

**5. Good design is unobtrusive — Score: 2/3**
   Evidence: ~9 always-on chips + per-row verdict chips; a decorative "Adam · Ranker" persona badge and two "Live" indicators (Weight §5; Copy §2).
   Justification: content is still the figure and most chips are functional data labels; the decoration is minor, so chrome is visible but quiet — anchor 2.

**6. Good design is honest — Score: 1/3**
   Evidence: no dark patterns and exemplary data honesty, BUT three chrome-level overstatements: the "Adam · Ranker" fake agent (`Leaderboard.tsx:24`), the non-functional "Ask AdBrain" search (`topbar.tsx:39-60`), and "Live" on a server snapshot (`topbar.tsx:33`).
   Justification: 2+ inflations/mismatches present — anchor 1. (Not 0: no deceptive flow; the data itself never lies.)

**7. Good design is long-lasting — Score: 2/3**
   Evidence: restrained, token-based, minimal CSS with no fad gradients/glassmorphism; the AI-persona chrome ("Adam", agent framing) is a mild era marker (Visual §3; Copy §2).
   Justification: one dated trend marker (AI-hype persona chrome) — anchor 2.

**8. Good design is thorough down to the last detail — Score: 1/3**
   Evidence: empty/loading/disabled present, but success feedback is largely missing, there is no app-level `error.tsx` boundary, and focus styling is absent on most controls incl. AdLink and the Ask input (Visual §5; A11y §2).
   Justification: 2–3 states missing/rough — anchor 1.

**9. Good design is environmentally friendly — Score: 2/3**
   Evidence: cockpit body fully server-rendered, ~110–140 KB gz, no heavy client libs, 0 idle animations; but dark mode is not honored and no `prefers-reduced-motion` handling exists (Weight §1,4; Visual §3).
   Justification: <500 KB and motion gated, but a 3 requires dark-mode honored — anchor 2.

**10. Good design is as little design as possible — Score: 1/3**
   Evidence: removable elements — the "Adam · Ranker" badge, one of two "Live" indicators, the non-functional Ask box, and the two permanently-dead MER/nCAC KPI cards (Structural §4; Copy §5; Weight §5).
   Justification: 3–5 removable elements — anchor 1.

---

**TOTAL: 15 / 30**  (2+2+1+1+2+1+2+1+2+1)
No principle scored 0. Five principles scored 1 (aesthetic, understandable, honest, thorough, little-design) — a broad design-execution weakness, not an IA or data failure.
