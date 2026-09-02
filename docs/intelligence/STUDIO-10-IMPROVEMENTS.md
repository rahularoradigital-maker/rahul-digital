# Studio — 10 ways to improve & improvise (grounded in the current code, 2026-09-02)

Read from the real module: `components/app/creative-production/studio.tsx` (865 lines, 3-step flow), the
concept engine (`lib/creative-production/strategy/concept-engine.ts`), the offer-based recommender
(`recommend/reason.ts`), and the QA engine (`qa/qa-engine.ts`). Today Studio is a strong **catalog →
concepts → static ad → export** flow. The theme of these 10: **Studio doesn't yet use the intelligence the
rest of the app already has** (winner / fatigue / diversity / Meta results). Connecting it is where the
value is.

## The 10

### 1. Recommend what to advertise by REAL performance + fatigue, not just offer size
Today `recommend/reason.ts` ranks products by only two things: "already advertised?" and discount depth. But
the app now has live winner + fatigue engines. **Improve:** rank products by (a) a proven winner whose
creative is now *fatiguing* (the exact moment to make a fresh variant), and (b) high-catalog-value products
with no live ad. 2nd-order: Studio stops being a catalog browser and becomes "here's the ad to make *today*,
and why."

### 2. Generate what's MISSING, using the Creative DNA diversity gaps
The Creative DNA read says this account is ~100% Lifestyle scene and ~87% Aspirational mood. Studio makes
more of the same. **Improve:** feed the diversity gaps into the concept engine so it deliberately proposes the
under-represented angles (product-demo, urgency/BOF, a different palette). "You're all lifestyle — here are 3
product-demo concepts to balance the account."

### 3. A/B variants per concept, not one asset
Studio generates ONE asset per concept. Media buyers test 2–4 variants. **Improve:** "Generate 3 variants" that
holds the product fixed and varies one lever each (hook, headline, visual direction), so the export is a
ready-to-test set, not a single image. Ties into #8 (learn which variant wins).

### 4. Video / motion concepts (Studio is static-only today)
The composer outputs static SVG→PNG. But the account runs heavily on video, and the app can already *read*
video motion (deep read). **Improve:** start with AI **video scripts / storyboards** (hook second-by-second,
shot list, on-screen text) as a draft deliverable, then real short video generation later. Biggest gap vs how
the account actually advertises.

### 5. Copy policy-lint before export
Studio never invents claims, but it doesn't check the *approved* copy against Meta ad policy (health/finance
claims, "before/after", personal-attribute wording, unproven superlatives). **Improve:** a lint pass on the
copy in Review that flags likely-rejection phrases before the buyer uploads. Saves real rejected-ad cycles.

### 6. Stronger QA (platform-aware)
`qa-engine.ts` checks contrast, text-pixels, and placeholder detection. **Improve:** add per-placement
**safe-zone** checks (text inside Meta's story/reel crop), **minimum mobile font size** at display scale,
per-placement **character limits** (Meta truncates long headlines), and logo legibility. Fewer bad exports,
less manual review.

### 7. One-click "push to Meta as a PAUSED draft"
Review currently exports a ZIP the buyer manually uploads. The Meta API is already wired in the app.
**Improve:** a button that creates the ad in Ads Manager as **PAUSED** (never live — respects the "never
auto-publish" rule) so the buyer just reviews and flips it on. Removes the whole ZIP→upload step.

### 8. Learn the user's taste from approve / reject
Every Approve/Reject in Review is a labeled preference that's currently thrown away. **Improve:** remember it
and rank future concepts by what this user has approved before (angle, palette, copy style). Studio gets more
"you" with every batch.

### 9. Close the loop: did the generated concept become a winner?
Nothing connects a generated draft to how it later performed as a live ad. **Improve:** match exported
creatives back to Meta results (by campaign name / creative hash) and show "concepts you made here that
became winners" — so the concept engine learns which *formulas* actually sell, not just which score highest
on paper.

### 10. Regional-language variants + non-Shopify onboarding + opportunity framing
Three smaller wins bundled: (a) **Hindi / regional-language** copy variants (one toggle) for Indian reach; (b)
a **CSV / manual product add** so non-Shopify stores (WooCommerce, custom) can use Studio at all — today it
needs a Shopify public feed; (c) show the **opportunity size** up front ("₹X of your catalog has no live ad")
so the user sees why to generate.

## Priority (impact × how much it rides existing engines)

| # | Improvement | Impact | Effort | Rides existing work? |
|---|---|---|---|---|
| 1 | Recommend by performance + fatigue | High | Med | winner/fatigue engines exist |
| 2 | Generate the missing angles (diversity gaps) | High | Med | diversity engine exists |
| 3 | A/B variants per concept | High | Low-Med | concept engine exists |
| 7 | Push to Meta as PAUSED draft | High | Med | Meta API wired |
| 5 | Copy policy-lint | Med | Low | new, small |
| 6 | Platform-aware QA | Med | Low-Med | extends qa-engine |
| 8 | Learn taste from approve/reject | Med | Med | approvals already stored |
| 9 | Closed-loop "did it win" | High | High | needs result-matching |
| 4 | Video / motion concepts | High | High | deep-read reads video |
| 10 | Language + non-Shopify + framing | Med | Low each | mostly new |

**Recommended first three:** #3 (A/B variants — quick, obviously useful), #1 (recommend by performance —
turns Studio proactive), #5 (policy-lint — cheap, saves real rejected ads). Then #7 (push-to-Meta) as the
flagship.

## One caveat
Studio is owned by another chat (`rahul-linkedin-2-04`) — `studio.tsx` is a hot file they edit often. Anything
built here must be coordinated with them (claim in `.claude/WIP.md`, prefer new files) to avoid collisions.
