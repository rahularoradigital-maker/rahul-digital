# AdBrain DESIGN.md

The design system for AdBrain AI, from the owner's design handoff (telli.com style), 2026-08-25.
Source of truth: `docs/design/HANDOFF.md` + the artboards in `docs/design/*.dc.html`
(Deepsolv=landing, Product, BookDemo, Dashboard=11-screen app). Every UI decision calibrates here.

> This SUPERSEDES the earlier "Yamin warm-paper / Schibsted-Grotesk" direction (decision D10) and
> the `cockpit-v1.html` mockup. Both are kept only as history. Implementation status: this is the
> TARGET; the shipped app still uses Phase 0 indigo/dark until the re-base.

## 0. Design principles (decision rules — unchanged, still hold)
1. **Decisions over dashboards** — every screen ends in an action.
2. **Show the working over "trust us"** — no number without source/formula/reason; AI narrates, code computes.
3. **Money over metrics** — quantify impact in currency + confidence.
4. **One honest number over five** — a single actionable composite (e.g. Account Health 0-100).
5. **Distinctive over default** — look like AdBrain (the telli system below), not a generic template.
6. **Confirmed over automatic, when money moves** — explicit human yes before spend changes.
Candidate (probation): **Real data over rules of thumb**.

## 1. Ethos
Decision-first, not a report. Every recommendation: Observation → Diagnosis → Evidence (+ rule ID)
→ Confidence → Action → Expected impact. Fact-label every value (OFFICIAL / RESEARCH-BACKED /
BENCHMARK / INTERNAL CALCULATION / MODEL ESTIMATE / INFERENCE). Guardrails: small samples flagged,
"insufficient data != waste", "active != winning", confidence on all forecasts, no arbitrary
thresholds as truth. Voice: plain, direct. No em dashes.

## 2. Color tokens (telli)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#F7F7F7` | page background |
| `--surface` | `#FFFFFF` | cards / inputs |
| `--surface-alt` | `#EFEFEF` | subtle fills, tracks, inactive |
| `--ink` | `#252525` | primary text + dark buttons/bands |
| `--ink-muted` | `#6B6B6B` | secondary text |
| `--accent` | `#038BF7` | brand blue — dots, active states, links, key CTAs. NEVER a field fill |
| `--accent-soft` | `#E6F2FE` | blue-tint backgrounds |
| `--hairline` | `#E4E4E4` | borders / dividers |

Semantic (verdict) colors, app only:
Scale/Won `#0f8a4d` on `#e7f4ec` · Iterate/warn `#b06b00` on `#fbf1df` ·
Kill/Failed `#c0392b` on `#fbecea` · Neutral chip `#6B6B6B` on `#EFEFEF`.

Rule: mono ink on light ground; blue is an accent, never a field. Near-black `#252525` bands for contrast.

## 3. Typography
- Font: **`Inter`**, 'Helvetica Neue', Arial, sans-serif (telli ships proprietary "Review"; Inter is the free match).
- **Headlines are weight 400 (LIGHT) — do not bold.** h1 56-64px/400 · h2 40px/400 · h3 18-22px/500.
- Body 15-18px/400 · small 12-14px.

## 4. Components
- **Card:** white, `1px solid --hairline`, **radius 10px**, generous padding.
- **Pill:** **radius 70px (fully rounded)** — buttons, inputs, tabs, chips.
- **Buttons:** primary = ink fill (`#252525`) / white text, pill; key CTA may use accent blue; secondary = white / hairline border, pill.
- **Chips/tags:** pill, semantic verdict colors for Scale/Iterate/Kill.
- **Score ring:** Account Health 0-100 radial + component bars.
- **Confidence bar / progress:** track `--surface-alt`, ink or accent fill.
- **"Show the working":** Observation→Diagnosis→Evidence(+rule ID)→Confidence→Action→impact.
- Charts: CSS % heights in a fixed-height flex row (`align-items:stretch`, column `height:100%`).

## 5. Layout
- **Marketing:** ~96-112px section rhythm; section order per HANDOFF (announcement bar → nav →
  hero w/ pill email capture → demo widget → trust → use cases → funding(dark) → how-it-works
  stepper → features → security → testimonials → case study → final CTA(dark) → footer).
- **Web app:** fixed **256px sidebar** (grouped nav: Decide / Creative / Media / Intelligence /
  Account) + sticky topbar (title, "Agents live", Ask AdBrain search, source/week selector,
  Re-scan). Client-side router via active state. 11 screens (see HANDOFF).
- Animations: scroll-reveal fade-up, card hover lift, live pulse dot, animated bars.

## 6. Anti-slop guardrails
- Blue is an accent only, never a field/background fill. No gradients except the security card.
- Headlines stay weight 400 (bolding them is the tell). Everything rounded (10px / 70px).
- Cards earn their place; data rows/tables are fine. Actions fire a confirmation toast.

## 7. Accessibility floor
- Body text >= 13px; contrast >= 4.5:1 (ink `#252525` on `#F7F7F7` passes ~13:1).
- Verify accent blue `#038BF7` on white as TEXT (~3.6:1 — use for large text/UI/links, darken for small body text).
- Touch targets >= 44px; every status color paired with a text label; visible focus rings; keyboard nav on all actions.
