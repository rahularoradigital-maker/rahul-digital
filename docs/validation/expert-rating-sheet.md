# Expert Rating Sheet — Validation V2

A media buyer reviews the recommendations AdBrain produced for a real account and rates each.
This tests the judgment calls the quantitative backtest (V1) can't. Fill one row per recommendation.

**Account:** __________  **Reviewer:** __________  **Date:** __________

| # | Recommendation (kind + outcome) | Correct? (Y/N) | Non-obvious? (Y/N) | Notes / why |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

## Scoring (spec V2 pass bar)
- **Correct rate** = (# rated Correct) / (total rated). **Pass if >= 80%.**
- **Non-obvious share** = (# rated Non-obvious) / (total rated). A meaningful share must be
  non-obvious — correct-but-obvious calls do not justify the product.

**Correct rate:** ____ %   **Non-obvious share:** ____ %   **Verdict:** PASS / FAIL

## Guidance for the reviewer
- "Correct" = you would make this move (or agree it is right) given the account.
- "Non-obvious" = you would NOT have easily caught this yourself just looking at Ads Manager.
- Note anything that felt wrong, risky, or that you'd need more data to trust.
