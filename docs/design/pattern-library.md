# AdBrain Pattern Library

Reusable UX patterns that recur across the 11-screen app. Complements `DESIGN.md` (tokens/
components) and the artboards (`docs/design/*.dc.html`). Every pattern serves the product's
spine: Observation → Diagnosis → Evidence → Confidence → Action. Tokens referenced are from
DESIGN.md (telli system).

Knowledge graph at a glance: **Decision Card** is the hub — it embeds a **Confidence Bar**, a
**Verdict Chip**, **Fact Labels**, and opens the **Show-the-Working Drawer**; the **Health Ring**
summarizes many; **Insufficient-Data State** is the honest fallback for all.

---

## 1. Decision Card  · category: display + feedback
- **Problem:** a media buyer needs to know what to do and *why*, fast, without trusting a black box.
- **Solution:** a card structured as Observation → Diagnosis → Evidence (+ rule ID) → Confidence
  bar → Action + expected impact. Bucketed DO NOW / DO NEXT / WATCH.
- **Anatomy:** verdict chip (required); one-line observation (required); diagnosis sentence
  (required); evidence rows with rule ID (required); confidence bar (required); action button +
  est. impact in money (required); "show the working" link (required).
- **Variants:** compact (queue list row) vs expanded (Action Center). Test-plan variant adds
  expected lift + Kill/Iterate/Scale.
- **Behavior:** action fires a confirmation toast; nothing applies to the live account without an
  explicit confirm ("nothing launches on its own"). Denied/snoozed items move buckets, with undo.
- **Examples:** GOOD — "Stop ad_42, past half-life. Saves ~Rs 1.8L/wk. [why]". ANTI — a bare
  "ROAS 1.8x" with no action (vanity; violates decision-gate).
- **Accessibility:** verdict conveyed by chip color **and** text; action button >= 44px; confidence
  bar has a text value, not color alone; keyboard-actionable.
- **Related:** embeds Confidence Bar, Verdict Chip, Fact Label; opens Show-the-Working Drawer.

## 2. Show-the-Working Drawer · category: display (trust)
- **Problem:** users won't act on a number they can't audit.
- **Solution:** a right-side slide-over that lays out source → formula → logic → example → next
  step for any number or recommendation. Rule: if you can't see source+formula+reason, it doesn't ship.
- **Anatomy:** title; labelled rows (source, formula, inputs, rule ID, confidence); a
  counter-explanation ("what could explain the opposite"). Introduces NO number not already shown.
- **Behavior:** modal dialog — focus trap, Esc closes, focus returns to the trigger. Missing
  evidence renders "source unavailable", never a fabricated fill.
- **Examples:** ANTI — showing the model's chain-of-thought as the justification (a CoT can be
  convincingly wrong; the *working* is the deterministic computation + citation).
- **Accessibility:** `role="dialog" aria-modal`, labelled by title, full keyboard nav.
- **Related:** opened by Decision Card, Metric-with-Explanation, Fatigue Badge.

## 3. Confidence Bar · category: feedback
- **Problem:** every forecast/recommendation carries uncertainty that must be visible, without fake precision.
- **Solution:** a labelled bar (e.g. "Confidence 72% — 4 signals agree") on every recommendation/forecast.
- **Anatomy:** track (`--surface-alt`), fill (ink or accent), a text value + one-line "why".
- **Variants:** low/med/high band coloring (still paired with text).
- **Accessibility:** never color-only; the percentage/label is text.
- **Related:** appears in Decision Card, Fatigue Badge, Marginal-ROAS.

## 4. Fact Label · category: display (trust)
- **Problem:** users must never mistake a derived/estimated value for an official platform fact.
- **Solution:** a small tag on every value: OFFICIAL / RESEARCH-BACKED / BENCHMARK / INTERNAL
  CALCULATION / MODEL ESTIMATE / INFERENCE / UNKNOWN.
- **Anatomy:** pill or superscript; neutral styling (not a status color, to avoid confusion with verdicts).
- **Examples:** GOOD — "Hook rate 28% (DERIVED)". ANTI — presenting hold rate as an official Meta metric.
- **Accessibility:** text label, expandable to a definition on hover/focus.
- **Related:** used by Metric-with-Explanation, Decision Card evidence rows.

## 5. Verdict Chip · category: display
- **Problem:** creative/ad status must read at a glance and survive colorblindness.
- **Solution:** semantic chip — Scale/Won `#0f8a4d`/`#e7f4ec`, Iterate/warn `#b06b00`/`#fbf1df`,
  Kill/Failed `#c0392b`/`#fbecea`, Neutral `#6B6B6B`/`#EFEFEF`.
- **Accessibility:** always chip color **plus** the word (Scale/Iterate/Kill); contrast >= 4.5:1.
- **Related:** Decision Card, Creative Fatigue, Test Plan.

## 6. Health Ring + Component Bars · category: display
- **Problem:** "one honest number" for account/creative health, that decomposes on demand.
- **Solution:** a 0-100 radial + the component bars that make it up (creative, diversity, fatigue,
  media efficiency, ...), each with its own weight and "why".
- **Behavior:** ring is summary; bars are the drill-down; each bar opens Show-the-Working.
- **Accessibility:** ring has a text value ("57 of 100"); not the sole signal.
- **Related:** summarizes many Decision Cards; drills into Fatigue/Diversity.

## 7. Fatigue Badge + Forecast Bars · category: display
- **Problem:** show current fatigue state AND its 7/14-day trajectory honestly.
- **Solution:** one of 8 states (Healthy→Severe→Recovering→Insufficient) + 7-day & 14-day
  probability bars, drivers list, confidence, recommended action — labelled MODEL ESTIMATE.
- **Accessibility:** state as text+color; forecast bars carry a numeric label and the "estimate" tag.
- **Related:** feeds Decision Card; uses Confidence Bar, Fact Label.

## 8. Insufficient-Data State · category: feedback (the honest empty state)
- **Problem:** thin data must never be dressed up as a number or as "waste".
- **Solution:** an explicit "not enough data yet" state naming what's missing and the min sample
  needed — never a fabricated value, never counted as bad performance ("insufficient data != waste").
- **Examples:** GOOD — "Only 4 days of data; fatigue needs 7. Check back." ANTI — showing a
  low-confidence ROAS as if it were reliable.
- **Accessibility:** warm, plain-language; a next action (what to connect / wait for).
- **Related:** the fallback for every metric, Decision Card, Fatigue Badge.

## 9. Action Row + Confirmation Toast · category: input (money-safe)
- **Problem:** actions that move real budget must be deliberate and reversible-in-intent.
- **Solution:** Approve / Deny / Snooze row; applying to the live account is a separate,
  explicitly-confirmed step; every applied change fires a toast and logs to Change History.
- **Behavior:** no auto-apply; high-value denies get a light confirm; undo available on staged decisions.
- **Accessibility:** 44px targets, >=8px spacing so a thumb can't hit the wrong one; toast is
  announced via a live region.
- **Related:** the action end of every Decision Card.

## Anti-patterns (library-wide)
- A metric with no decision on a primary surface (vanity) — move to advanced or cut.
- Color-only status. Accent blue used as a field fill. Bolded headlines (telli headlines are 400).
- A forecast shown as a fact; a benchmark shown without a source; the model's CoT shown as "the working".
