# Accessibility Audit: AdBrain Cockpit (cockpit-v1.html)
**Standard:** WCAG 2.1 AA | **Date:** 2026-08-25

Audited the cockpit mockup + DESIGN.md tokens. Many operable/robust items are already
*specified* in the [interaction spec](../ux/cockpit-interaction-spec.md) but NOT in the static
mockup — those are "build must honor" gaps. One is a real DESIGN.md token problem (ochre text).

### Summary
**Issues found:** 8 | **Critical:** 1 | **Major:** 6 | **Minor:** 1

### Findings

#### Perceivable
| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| 1 | Ochre `#A8761F` "watch" label text on cream = **3.65:1** (small text needs 4.5:1) | 1.4.3 | 🔴 Critical | Use a darker ochre for TEXT (target >=4.5:1, e.g. ~`#7A5510`); keep `#A8761F` only for dots/large. **DESIGN.md token fix.** |
| 2 | Sparklines and the health-score donut have no text alternative | 1.1.1 | 🟡 Major | `aria-label`/`role="img"` with the value + trend (which already exist as text) |
| 3 | Creative-leaderboard ad images will have no alt text | 1.1.1 | 🟡 Major | Reuse the Deconstructor's creative description as `alt` (near-free, see ability map) |
| 4 | Section titles are `<div>`, no landmarks, cards not a list | 1.3.1 | 🟡 Major | `<header><nav><main>`, `<h1..h3>`, `<ul>` for card groups |

#### Operable
| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| 5 | No visible focus indicator in the mockup | 2.4.7 | 🔴 Critical* | Add >=2px focus ring, >=3:1 vs cream (spec requires it; build must ship it) |
| 6 | Touch targets below 44px (working pill ~22px, approve/deny ~34px) | 2.5.5 | 🟡 Major | Pad to >=44x44 (spec requires 44px; mockup violates) |
| 7 | Fixed multi-column grids, no breakpoints -> horizontal scroll at 320px / 200% zoom | 1.4.10 | 🟡 Major | Implement the responsive rules from the interaction spec |

*Critical for keyboard/low-vision users; already specified, just not in the mockup.

#### Understandable
No new failures. Status uses dot color + text label, so 1.4.1 (use of color) PASSES.
Auth-page inputs already have visible labels (3.3.2 pass, per the code review). Cockpit has no forms.

#### Robust
| # | Issue | WCAG | Severity | Recommendation |
|---|---|---|---|---|
| 8 | Toggle pills (window/objective) show "selected" by color/fill only; drawer lacks dialog semantics | 4.1.2 | 🟡 Major | `aria-pressed` on toggles; `role="dialog" aria-modal` + focus trap on the drawer (spec has this) |

### Color contrast check (computed)
| Element | FG | BG | Ratio | Required | Pass |
|---|---|---|---|---|---|
| Body ink | #17170F | #F7F5EF | 16.52 | 4.5 | ✅ |
| Muted text | #6B6A5E | #F7F5EF | 5.01 | 4.5 | ✅ |
| Green "scale/healthy" text | #3F7A55 | #F7F5EF | 4.67 | 4.5 | ✅ (tight) |
| **Ochre "watch" text** | #A8761F | #F7F5EF | **3.65** | 4.5 | ❌ |
| Rust "stop" text | #A83A2E | #F7F5EF | 5.82 | 4.5 | ✅ |
| Link/"working" | #2E4A7D | #F7F5EF | 8.05 | 4.5 | ✅ |
| Cream on dark panel | #F7F5EF | #17170F | 16.52 | 4.5 | ✅ |
| Bottom-bar grey | #8A8879 | #17170F | 5.04 | 4.5 | ✅ |
| Dark-panel body | #C7C4B7 | #17170F | 10.30 | 4.5 | ✅ |

Only the ochre-as-small-text fails. (Ochre at large sizes / for the status dot passes the 3:1 bar.)

### Keyboard navigation (per interaction spec — designed, verify in build)
| Element | Tab | Enter/Space | Escape | Arrows |
|---|---|---|---|---|
| Window/objective pills | in order | Space selects | - | Arrow between (spec) |
| Approve/Deny/Snooze | in order | Enter acts (A/D/S shortcuts) | - | - |
| Show-the-working | in order | Enter opens | closes drawer | - |
| Apply confirm | in order | Enter on Apply | Cancel | - |

### Screen reader
| Element | Announced As | Issue |
|---|---|---|
| Health donut | (nothing) | needs `role="img"` + "57 of 70 green, 81% healthy" |
| Sparkline | (nothing) | needs label with value + trend |
| Toggle pill (selected) | "button" | needs `aria-pressed="true"` |
| Ad image (leaderboard) | (nothing) | needs `alt` from the AI description |

### Priority fixes
1. **Ochre text contrast (1.4.3)** — the one that affects the design SYSTEM (a token fix, inherited by every correct build). Darken ochre for text use.
2. **Focus indicator (2.4.7)** — blocks all keyboard users; specified, must ship.
3. **Semantic structure + graphic alts (1.3.1/1.1.1)** — screen-reader users; the ad-image alt is near-free via the Deconstructor.
4. **Touch targets + reflow (2.5.5/1.4.10)** — mobile + low-vision; already in the spec, build must honor.

### Relationship to prior a11y work
Formalizes the a11y flags from the [ability spectrum map](ability-spectrum-map-2026-08-25.md) and
[heuristic eval](heuristic-evaluation-cockpit-2026-08-25.md) into WCAG criteria + measured ratios.
The NEW, must-act item is finding #1 (ochre token) — a design-system fix, not just "build to spec."
```
