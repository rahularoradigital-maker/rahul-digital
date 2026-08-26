# AdBrain Creative Winner, Loser and Fatigue Evaluation Framework

## Objective

AdBrain should evaluate every creative beyond basic platform metrics.

The core question is:

> Why is this creative winning or losing, what changed, where did it change, and what should we do next?

The system should combine creative, audience, funnel, financial and time-based signals.

## 1. Creative Identity

| Parameter | What AdBrain should capture | Why it matters |
|---|---|---|
| Creative ID | Unique ad ID | Tracks the same creative over time |
| Creative age | Days since launch | A 2-day winner is different from a 60-day winner |
| First live date | Date launched | Helps calculate longevity |
| Last edit date | Latest major edit | Major edits can change interpretation |
| Creative format | Video / Static / Carousel | Formats behave differently |
| Aspect ratio | 1:1 / 4:5 / 9:16 etc. | Placement compatibility |
| Placement | Feed / Stories / Reels / Audience Network | Performance can vary by placement |
| Creative version | V1 / V2 / V3 | Tracks iterations |
| Creative family | Parent concept | Shows whether the concept itself works |

## 2. Product and Offer

| Parameter | What AdBrain should capture |
|---|---|
| Product shown | Exact SKU/product |
| Product count | 1 product / multiple products |
| Category shown | Single product / category / collection |
| Hero product | Main product in ad |
| Product price | Price shown |
| Discount shown | % or ₹ discount |
| Offer type | Discount / Bundle / Free shipping / Gift / Subscription |
| Offer visibility | Clear / weak / absent |
| Product margin | Gross contribution where available |
| Best seller flag | Yes / No |
| New product | Yes / No |
| Product availability | In stock / low stock / out of stock |
| Product page used | Exact landing page |
| Product category | Category / sub-category |
| AOV relationship | Does this ad drive higher or lower AOV? |

A ₹5,000 ROAS ad selling a high-margin product is not automatically equal to a ₹5,000 ROAS ad selling a low-margin product.

## 3. Human and Visual Composition

| Parameter | Example |
|---|---|
| Person present | Yes / No |
| Person count | 1 / 2 / Group |
| Gender representation | Male / Female / Mixed |
| Approx. age | Young / Adult / Mature |
| Creator type | UGC creator / Actor / Founder / Customer / Expert |
| Face visible | Yes / No |
| Product held | Yes / No |
| Product worn | Yes / No |
| Product demonstrated | Yes / No |
| Before/after | Yes / No |
| Lifestyle scene | Yes / No |
| Studio/product shot | Yes / No |
| Outdoor/indoor | Indoor / Outdoor |
| Background | Plain / Lifestyle / Retail / Home / Office |
| Camera style | Phone / Professional / Screen recording |
| Camera movement | Static / Handheld / Fast cuts |
| Text overlays | Yes / No |
| Amount of text | Low / Medium / High |
| Captions | Yes / No |
| Logo visibility | Early / Mid / End |
| Product visibility | Early / Mid / End |

## 4. Audio and Video Construction

| Parameter | What to compare |
|---|---|
| Music | Yes / No |
| Voiceover | Yes / No |
| Speaker | Male / Female |
| Founder voice | Yes / No |
| Customer voice | Yes / No |
| Expert voice | Yes / No |
| Trending audio | Yes / No |
| Original audio | Yes / No |
| Hook in first 3 sec | Yes / No |
| Product appears in first 3 sec | Yes / No |
| Text appears in first 3 sec | Yes / No |
| Problem appears in first 3 sec | Yes / No |
| Brand appears in first 3 sec | Yes / No |
| Video length | Seconds |
| 3-sec retention | % |
| 25% View Rate | % |
| 50% View Rate | % |
| 75% View Rate | % |
| 95% View Rate | % |
| 100% View Rate | % |
| ThruPlay Rate | % |
| Hold Rate | % |
| Average watch time | Seconds |

## 5. Hook and Message

| Parameter | Examples |
|---|---|
| Hook type | Problem / Curiosity / Benefit / Shock / Social proof |
| Hook strength | Score 1-10 |
| Problem-led | Yes / No |
| Benefit-led | Yes / No |
| Fear-led | Yes / No |
| Desire-led | Yes / No |
| Education-led | Yes / No |
| Comparison | Yes / No |
| Testimonial | Yes / No |
| Demonstration | Yes / No |
| Founder-led | Yes / No |
| Offer-led | Yes / No |
| Objection handling | Yes / No |
| Proof type | Review / Expert / Data / Before-after |
| CTA | Shop now / Learn more / Sign up / Book demo |
| Angle | Price / Quality / Convenience / Ingredient / Outcome |
| Persona | Target buyer |
| Awareness stage | Unaware / Problem aware / Solution aware / Product aware |

## 6. Top-of-Funnel Attention Metrics

| Parameter | Formula |
|---|---|
| CPM | Spend / Impressions × 1,000 |
| Thumb Stop Rate | 3-sec Views / Impressions × 100 |
| 3-sec View Rate | 3-sec Views / Impressions × 100 |
| 25% View Rate | 25% Views / Video Starts × 100 |
| 50% View Rate | 50% Views / Video Starts × 100 |
| 75% View Rate | 75% Views / Video Starts × 100 |
| 95% View Rate | 95% Views / Video Starts × 100 |
| 100% View Rate | Complete Views / Video Starts × 100 |
| ThruPlay Rate | ThruPlays / Impressions × 100 |
| Hold Rate | ThruPlays / 3-sec Views × 100 |

## 7. Traffic Quality

| Parameter | Formula |
|---|---|
| Link CTR | Link Clicks / Impressions × 100 |
| CPC | Spend / Link Clicks |
| LPV Rate | LPV / Link Clicks × 100 |
| Cost / LPV | Spend / LPV |
| Click to LPV Loss | 100 - LPV Rate |
| Landing Page Bounce Rate | Bounced Sessions / Sessions × 100 |
| Engaged Session Rate | Engaged Sessions / Sessions × 100 |
| Average Engagement Time | Direct GA4 measurement |

## 8. Ecommerce Funnel

| Parameter | Formula |
|---|---|
| LPV → ATC | ATCs / LPVs × 100 |
| Cost / ATC | Spend / ATCs |
| ATC → Checkout | Checkouts / ATCs × 100 |
| Cost / Checkout | Spend / Checkouts |
| Checkout → Purchase | Purchases / Checkouts × 100 |
| ATC → Purchase | Purchases / ATCs × 100 |
| LPV → Purchase | Purchases / LPVs × 100 |
| Click → Purchase | Purchases / Link Clicks × 100 |
| Purchase Rate | Purchases / Sessions × 100 |
| CPA | Spend / Purchases |
| AOV | Revenue / Purchases |
| ROAS | Revenue / Spend |

## 9. Lead Generation Funnel

| Parameter | Formula |
|---|---|
| LPV → Lead | Leads / LPVs × 100 |
| Click → Lead | Leads / Link Clicks × 100 |
| CPL | Spend / Leads |
| Lead → MQL | MQLs / Leads × 100 |
| MQL → SQL | SQLs / MQLs × 100 |
| SQL → Customer | Customers / SQLs × 100 |
| Lead → Customer | Customers / Leads × 100 |
| Cost / MQL | Spend / MQLs |
| Cost / SQL | Spend / SQLs |
| CAC | Spend / New Customers |

## 10. Day-by-Day Performance and Deterioration

AdBrain should not only show a 30-day total. It should understand how the creative changes over time.

| Parameter | What to monitor |
|---|---|
| Day 1 → Day 2 | Did performance improve? |
| Day 3 → Day 7 | Is the creative settling? |
| Last 3 days vs previous 3 | Short-term deterioration |
| Last 7 days vs previous 7 | Clear trend |
| CTR trend | Rising or falling |
| CPM trend | Rising or falling |
| CPC trend | Rising or falling |
| Cost / LPV trend | Rising or falling |
| Cost / ATC trend | Rising or falling |
| Cost / Checkout trend | Rising or falling |
| CPA trend | Rising or falling |
| ROAS trend | Rising or falling |
| AOV trend | Rising or falling |
| LPV → ATC trend | Improving or worsening |
| ATC → Checkout trend | Improving or worsening |
| Checkout → Purchase trend | Improving or worsening |
| Frequency trend | Rising or stable |

Example:

- Day 1 Cost/ATC = ₹180
- Day 3 Cost/ATC = ₹190
- Day 5 Cost/ATC = ₹235
- Day 7 Cost/ATC = ₹290

AdBrain should say:

> Creative is losing efficiency at the cart stage. Cost per ATC increased 61% in 7 days.

This is more useful than only saying:

> ROAS decreased.

## 11. Audience Context

| Parameter | What to compare |
|---|---|
| Frequency | Impressions / Reach |
| Reach growth | Current vs previous period |
| Frequency growth | Current vs previous period |
| Cold audience | Yes / No |
| Warm audience | Yes / No |
| Retargeting | Yes / No |
| Lookalike | Yes / No |
| Broad | Yes / No |
| Age | Best / worst |
| Gender | Best / worst |
| Geography | Best / worst |
| Placement | Best / worst |
| Audience overlap | % where available |
| New customer share | % |
| Existing customer share | % |

## 12. Creative Diversity

AdBrain should understand whether the account is actually testing different ideas.

Track:

- Number of active creatives
- Number of unique hooks
- Number of unique angles
- Number of unique offers
- Number of unique formats
- Number of unique creators
- Number of unique products
- Number of unique personas
- Number of unique visual styles
- Number of unique CTAs

### Creative Diversity Score

Example:

10 active ads, but:

- 8 use the same hook
- 7 use the same creator
- 9 use the same offer
- 8 use the same visual format

AdBrain should say:

> 10 ads are live, but creative diversity is low. Most ads are variations of one concept.

## 13. Creative Lifecycle

Track:

- Days live
- Spend to date
- Peak performance date
- Peak ROAS
- Current ROAS
- Peak CTR
- Current CTR
- Peak CPA
- Current CPA
- Frequency at peak
- Frequency now
- Days since peak
- % decline from peak
- Spend since peak
- Purchases since peak

This answers:

> Was this a real winner or just a launch spike?

## 14. Winner Classification

A creative should not become a winner only because it has a high ROAS.

AdBrain should evaluate:

- Enough spend?
- Enough purchases?
- Enough days?
- Stable performance?
- Strong funnel movement?
- Good CPA?
- Good AOV?
- Good new customer acquisition?
- Low fatigue?
- Good creative diversity contribution?
- Can it scale?

Example:

Ad A:
- ROAS 8x
- Spend ₹3,000
- 2 purchases

Ad B:
- ROAS 4.5x
- Spend ₹2,00,000
- 180 purchases
- Stable for 30 days

For a media buyer, Ad B may be the more valuable winner.

## 15. Loser Classification

Do not call an ad a loser because of one bad metric.

Check:

- Enough spend?
- Enough data?
- Was audience quality different?
- Was CPM unusually high?
- Did LPV Rate break?
- Did ATC Rate break?
- Did Checkout Rate break?
- Did Purchase Rate break?
- Is product out of stock?
- Was the landing page changed?
- Was there a promotion change?
- Is tracking broken?

Then classify:

- True loser
- Early loser
- Low-data
- Funnel problem
- Audience problem
- Tracking problem
- Product problem
- Creative fatigue

## 16. Final AdBrain Creative Decision

Every creative should ultimately receive a decision such as:

### WINNER

Confidence: 91%

Why:
- Strong CTR
- Strong LPV → ATC
- CPA below account average
- ROAS stable for 21 days
- Frequency still healthy
- No major fatigue
- Works across 3 audiences

### REFRESH

Confidence: 88%

Why:
- Thumb stop rate still healthy
- Hold rate declining
- Cost/ATC +42% in 7 days
- Frequency increased from 2.1 → 3.7
- CTR down 28%
- ROAS down 31%

### DO NOT KILL YET

Confidence: 95%

Why:
- ROAS looks weak
- Only ₹8K spent
- 4 purchases
- Not enough data
- Continue testing

## 17. Core Principle

AdBrain should not become a bigger dashboard.

It should become a decision system.

The final question it should answer is:

> Why is this creative winning or losing, what changed, where did it change, and what should I do next?

The evaluation should consider:

Attention → Click → Landing Page → ATC → Checkout → Purchase → Revenue

And the surrounding context:

Creative → Audience → Product → Offer → Placement → Time → Funnel → Profitability.
