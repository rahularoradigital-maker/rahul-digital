# Creative Intelligence Check Score Guide

## What `19 of 37 checks green` means

The verdict score is built from the backend `check_board`.

- `green` = how many countable checks passed
- `total` = how many checks were counted
- headline score = sum of `green` and `total` across the four score cards:
  - Analytics
  - Fatigue
  - Diversity
  - Exposure

## Important note about why this is `37` and not `38`

In the current code, there are normally **38 countable checks**:

- Analytics: 9
- Fatigue: 11
- Diversity: 12
- Exposure: 6

A run becomes **37** when the fatigue check `audience_saturation_elevated` is **withheld** and therefore not counted.

That usually happens when the system decides:

> "Do not confidently blame audience saturation at the account level."

So the list below is the **37 counted checks** for a run where that one fatigue check is withheld.

## Checks that do NOT count in the headline score

These rules may exist in the payload, but they are informational and do not increase the `37` total:

- `waste_total_weekly`
- `waste_zero_result_spend`
- `waste_losing_pattern_spend`
- `runway_cliff_zero_days`

---

# 37 Counted Checks

## A. Analytics checks (9)

### 1. Too much spend on ads to pause
- Rule id: `pause_spend_share_high`
- Where evaluated: Analytics / ad ledger
- Passes when:
  - spend share on `pause` ads is below the configured impact threshold
- Fails when:
  - too much account spend is sitting on ads already judged pause-worthy

### 2. Too many ads to pause
- Rule id: `pause_ad_count_high`
- Where evaluated: Analytics / ad ledger
- Passes when:
  - the number of `pause` ads stays below the action minimum
- Fails when:
  - too many ads are landing in the pause bucket

### 3. Too much spend on ads to watch
- Rule id: `watch_spend_share_high`
- Where evaluated: Analytics / ad ledger
- Passes when:
  - spend share on `watch` ads is below the configured threshold
- Fails when:
  - too much spend is on ads that are shaky but not yet kill-worthy

### 4. No ads ready to scale
- Rule id: `no_scale_candidates`
- Where evaluated: Analytics / winning patterns
- Passes when:
  - at least one scale candidate exists
  - or there are too few eligible ads to expect a scale candidate
- Fails when:
  - there are enough ads to judge, but none are ready to scale

### 5. Losing patterns still live
- Rule id: `losing_patterns_present`
- Where evaluated: Analytics / winning-losing patterns
- Passes when:
  - no losing patterns are present
- Fails when:
  - one or more losing patterns are still active in the account

### 6. Winning patterns too thin to act
- Rule id: `winning_patterns_underpowered`
- Where evaluated: Analytics / patterns
- Passes when:
  - winning patterns have enough supporting ads behind them
- Fails when:
  - a pattern looks good, but sample support is too thin to trust for action

### 7. Creative tags cover the library
- Rule id: `crystal_coverage_meets_l2`
- Where evaluated: Analytics / data quality
- Passes when:
  - creative-tag coverage reaches the required level
- Fails when:
  - the creative library is not tagged deeply enough for strong analytics confidence

### 8. Ads below the reporting floor
- Rule id: `ads_excluded_by_floor`
- Where evaluated: Analytics / data quality
- Passes when:
  - no ads were excluded for being below the reporting floor
- Fails when:
  - one or more ads could not be judged because they lacked enough data

### 9. Winners carrying too much spend
- Rule id: `winner_over_concentrated_ads`
- Where evaluated: Analytics / money map
- Passes when:
  - no winning ads are over-concentrated
- Fails when:
  - a few winners are carrying too much of the spend load

---

## B. Fatigue checks (10 counted in a 37-check run)

### 10. Fatigue scores are available
- Rule id: `fatigue_available`
- Where evaluated: Fatigue
- Passes when:
  - fatigue scoring data exists for the run
- Fails when:
  - fatigue signals are unavailable

### 11. Average fatigue is at risk
- Rule id: `mean_fatigue_at_risk`
- Where evaluated: Fatigue
- Passes when:
  - the spend-weighted average fatigue score stays below the risk threshold
- Fails when:
  - the account’s average fatigue reading is too high

### 12. Spend on ads that need action now
- Rule id: `act_now_spend_share`
- Where evaluated: Fatigue
- Passes when:
  - the share of spend on `ACT_NOW` ads stays below the force-P0 threshold
- Fails when:
  - too much spend is sitting on ads that need immediate action

### 13. Ads that need action now
- Rule id: `act_now_ads_present`
- Where evaluated: Fatigue
- Passes when:
  - there are zero `ACT_NOW` ads
- Fails when:
  - one or more ads are already in immediate fatigue trouble

### 14. Ads that need rotating
- Rule id: `rotate_ads_present`
- Where evaluated: Fatigue
- Passes when:
  - there are zero `ROTATE` ads
- Fails when:
  - one or more ads should be rotated out

### 15. Too many ads due for a refresh
- Rule id: `refresh_ads_high`
- Where evaluated: Fatigue
- Passes when:
  - refresh count stays below the action minimum
- Fails when:
  - too many ads are due for creative refresh

### 16. Too much spend on tired ads
- Rule id: `fatigue_at_risk_spend_share`
- Where evaluated: Fatigue
- Passes when:
  - spend share on fatigue-at-risk ads stays below the configured threshold
- Fails when:
  - too much account spend is exposed to tired creatives

### 17. Winners wearing out
- Rule id: `winner_wearing_out_ads`
- Where evaluated: Fatigue / money map
- Passes when:
  - no winners are in the `wearing out` state
- Fails when:
  - one or more winning ads are getting tired

### 18. Weak ads that are also tired
- Rule id: `weak_and_fatigued_ads`
- Where evaluated: Fatigue / ad ledger
- Passes when:
  - no ads are both weak and fatigued
- Fails when:
  - weak performance and fatigue overlap on the same ads

### 19. Ads queued to replace
- Rule id: `top_replacement_candidates`
- Where evaluated: Fatigue
- Passes when:
  - there are no top replacement candidates
- Fails when:
  - the model has clear candidates that should be replaced soon

### Withheld fatigue rule in a 37-check run
- Rule id: `audience_saturation_elevated`
- Normal meaning:
  - asks whether the audience looks used up
- Normally passes when:
  - average audience-saturation score is below threshold
- Normally fails when:
  - average audience-saturation score is elevated
- Why not counted here:
  - it can be marked `withheld` when the system suppresses the account-level audience saturation claim

---

## C. Diversity checks (12)

### 20. One copy style dominates the library
- Rule id: `dominance_copy`
- Where evaluated: Diversity / crystal scores
- Passes when:
  - no single copy style exceeds the dominance threshold
- Fails when:
  - one copy style dominates too much of the library

### 21. One colour palette dominates the library
- Rule id: `dominance_colors`
- Where evaluated: Diversity / crystal scores
- Passes when:
  - no single colour style dominates too much
- Fails when:
  - one colour palette is overused

### 22. One setting dominates the library
- Rule id: `dominance_environment`
- Where evaluated: Diversity / crystal scores
- Passes when:
  - no single environment dominates too much
- Fails when:
  - the same environment keeps repeating

### 23. One mood dominates the library
- Rule id: `dominance_mood`
- Where evaluated: Diversity / crystal scores
- Passes when:
  - no mood dominates above threshold
- Fails when:
  - one emotional tone is overused

### 24. One talent look dominates the library
- Rule id: `dominance_talent`
- Where evaluated: Diversity / crystal scores
- Passes when:
  - talent representation is not overly concentrated
- Fails when:
  - the same talent look appears too often

### 25. One audio style dominates the library
- Rule id: `dominance_audio`
- Where evaluated: Diversity / crystal scores
- Passes when:
  - no audio style dominates above threshold
- Fails when:
  - the same audio feel is repeated too much

### 26. One hook dominates the library
- Rule id: `dominance_hook`
- Where evaluated: Diversity / crystal scores
- Passes when:
  - no single hook exceeds the dominance threshold
- Fails when:
  - the same hook is reused too heavily

### 27. One offer dominates the library
- Rule id: `dominance_offer`
- Where evaluated: Diversity / crystal scores
- Passes when:
  - no offer dominates too much
- Fails when:
  - the same offer shows up across too much of the library

### 28. One format dominates the library
- Rule id: `dominance_format`
- Where evaluated: Diversity / format distribution
- Passes when:
  - no single format exceeds the format dominance threshold
- Fails when:
  - one format, like reels/static/video, dominates too much

### 29. Near-copy cluster
- Rule id: `similarity_cluster_duplicate_drag`
- Where evaluated: Diversity / similarity clusters
- Passes when:
  - the biggest near-copy cluster stays below the duplicate-drag threshold
- Fails when:
  - too many ads are near copies of each other

### 30. Library concentration is moderate
- Rule id: `diversity_severity_moderate`
- Where evaluated: Diversity / overall severity
- Passes when:
  - diversity severity is below `moderate`
- Fails when:
  - the account has at least moderate concentration problems

### 31. Library concentration is severe
- Rule id: `diversity_severity_severe`
- Where evaluated: Diversity / overall severity
- Passes when:
  - severity is not `severe`
- Fails when:
  - the library is judged severely concentrated

---

## D. Exposure checks (6)

### 32. Portfolio exposure score is available
- Rule id: `pes_available`
- Where evaluated: Exposure
- Passes when:
  - portfolio exposure score exists
- Fails when:
  - the score could not be calculated

### 33. Portfolio exposure is critical
- Rule id: `pes_critical_band`
- Where evaluated: Exposure
- Passes when:
  - the portfolio score is below the critical band
- Fails when:
  - the score enters the critical range

### 34. Portfolio exposure is elevated
- Rule id: `pes_elevated_band`
- Where evaluated: Exposure
- Passes when:
  - the score is below the elevated band
- Fails when:
  - exposure is elevated or worse

### 35. Audience overlap is elevated
- Rule id: `overlap_component_elevated`
- Where evaluated: Exposure / PES overlap component
- Passes when:
  - overlap stays below the elevated threshold
- Fails when:
  - too much of the portfolio is colliding on the same audience

### 36. Ads past their half life
- Rule id: `past_half_life_ads`
- Where evaluated: Exposure / fatigue-exposure layer
- Passes when:
  - zero eligible ads are already past half life
- Fails when:
  - one or more ads are already past their safe exposure life

### 37. Ads close to their limit
- Rule id: `near_death_or_disagreement`
- Where evaluated: Exposure / break forecast / watchouts
- Passes when:
  - there are no near-death ads and no disagreement watchouts
- Fails when:
  - ads are close to their limit
  - or exposure disagreement/watchout signals exist

---

# How to verify the `19` is correct

For each check, the backend stores:

- `rule`
- `threshold`
- `actual`
- `ok`
- optional `state` like `withheld`

Then the backend computes:

- `total` = counted checks only
- `red_count` = counted checks where `ok = false`
- `green` = `total - red_count`

The UI headline score is then:

- `checks_green = sum(card.green)`
- `checks_total = sum(card.total)`

So to verify a run manually:

1. Open each of the four read cards:
   - Analytics
   - Fatigue
   - Diversity
   - Exposure
2. Open `Why`
3. For each rule:
   - if `state = withheld`, do not count it
   - if the rule is one of the non-headline informational rules, do not count it
   - if `ok = true`, count it as green
   - if `ok = false`, count it as red
4. Add all green checks together
5. Add all counted checks together

That should match the black score box.

---

# Source references

Backend rule assembly:
- `python_imagive/app/workflows/creative_intelligence/synthesis/scoring.py`

Rule labels and thresholds:
- `python_imagive/app/workflows/creative_intelligence/synthesis/constants.py`

Frontend score aggregation:
- `imagive/src/components/CreativeAnalytics/Report/intelligence/utils/uiPresentation.js`

Frontend per-card `Why` inspector:
- `imagive/src/components/CreativeAnalytics/Report/intelligence/panels/CheckBoard.jsx`