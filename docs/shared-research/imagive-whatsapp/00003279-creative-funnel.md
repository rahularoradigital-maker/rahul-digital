# Creative Funnel workflow

A guide to the `creative-funnel` workflow, written for someone who has **never used
Meta Ads**. Every abbreviation is spelled out the first time it appears, and
[Section 1A](#1a-how-the-code-decides-a-funnel-in-plain-words) explains the whole
decision in plain words, and [Section 2](#2-glossary--every-short-form-explained)
is a dictionary you can jump back to at any time.

---

## 1. What this workflow does, in plain words

When someone buys ads on Facebook or Instagram, a person has to walk through
several steps before money arrives:

```
sees the ad  ->  clicks it  ->  the web page loads  ->  puts item in cart
             ->  starts checkout  ->  pays
```

**People drop out at every step.** That staircase is called a **funnel** — wide at
the top, narrow at the bottom, like a kitchen funnel.

The important question is not "did we make money", it is **"which single step is
losing the most people?"** Fixing the worst step is the cheapest way to earn more,
because every step multiplies together. If half the people who put something in
the cart never reach checkout, no amount of better video fixes that — the problem
is the cart page.

This workflow answers exactly that question, for every ad in an account:

1. It downloads every ad and its numbers from Meta.
2. It labels each ad **TOF / MOF / BOF** (top, middle, bottom of the funnel — see
   glossary).
3. It calculates every funnel rate, and **shows the formula next to every number**.
4. It compares each ad to *the account's own best ad with the same goal*, and names
   the weakest step plus the reason.

It deliberately does **not** use AI for this. Every number is arithmetic you can
check by hand.

---

## 1A. How the code decides a funnel, in plain words

This is the short version. Section 6B has the same thing with exact numbers.

### It is really two separate decisions

People say "the funnel" to mean two different things, and the code answers them one
at a time:

1. **Where does this ad sit?** Is it meeting new people, helping them decide, or
   closing the sale.
2. **Where are we losing people?** Which single step in the journey is worst.

### Decision 1: where the ad sits

Think of a shop. Someone hands out flyers on the street, someone else answers
questions at the door, and someone at the till takes the money. All three are useful,
and you would not judge the flyer person on how much cash is in the till.

The code decides which of those three jobs an ad has by asking a simple question:
**what did you tell Meta to go and get?**

- Told Meta to get **reach or video views** -> this ad hands out flyers -> **TOF**
- Told Meta to get **clicks or page views** -> this ad answers questions -> **MOF**
- Told Meta to get **purchases or leads** -> this ad works the till -> **BOF**

That instruction is called the *optimization goal*, and it is the most reliable
signal because it is what Meta actually acts on. If it is missing, the code falls
back to the campaign objective, which is a weaker clue.

Sometimes the two disagree. A campaign can say "sales" while the ad set is really
told to fetch page views. In that case the code trusts the ad set, lowers its own
confidence, and flags the ad for a human to check. It never hides the disagreement.

### Decision 2: where we are losing people

The journey to a sale is a chain, and each link is a percentage:

```
saw the ad -> clicked -> page loaded -> added to cart -> started paying -> paid
```

Because these multiply, the chain is only as strong as its worst link. Improving the
worst link by a tenth improves the whole result by a tenth. That is why finding the
worst link matters more than making the video prettier.

So for every step, the code asks: **has this account ever done better?**

It finds the best-performing ad that had the same goal, and compares. The biggest
shortfall wins, and that step is named the leak.

**A real example.** One ad got 6 people out of 100 to add to cart. Another ad in the
same account, same goal, got 25 out of 100. So the first ad is doing a quarter as
well as the account has proven it can do. That gap is far bigger than any gap in its
video or its clicks, so the cart step is the leak — not the creative.

Notice what it is compared against: **the account's own best ad**, never an industry
average. The point is not "is this good", it is "have we already done better".

### What the code reads from Meta, and what it uses each thing for

Nothing here is guessed. Every piece comes from Meta, and each one earns its place by
feeding a decision.

**From the account** — just one thing: the **currency**. That is what picks the spend
floor. An Indian account is judged against 300 rupees, a US account against 5 dollars.
Without it the floor would be meaningless.

**From the campaign** — its **name**, its **objective**, and whether it is auction or
reserved buying. The objective is the fallback for deciding the stage, and more
importantly it is how ads are **grouped for fair comparison**: a sales ad is only ever
measured against other sales ads.

**From the ad set** — the **optimization goal**, which is the main signal for the
stage, plus the name, the billing event, the bid strategy and the schedule. The goal
matters most because it is the instruction Meta actually follows.

**From the ad** — its name, whether it is really running, and when it was created and
last edited. The edit date matters because changing an ad resets what its numbers mean.

**From the creative — the actual words and pictures:**

- the **headline and body text**, including every variant when Meta is rotating several
- the **description** lines
- the **call to action** — the button, like *Shop Now* or *Learn More* — and the link
  it points at
- the **image, thumbnail and video**, so the report can show you the ad itself
- the Instagram permalink, so you can open the live post
- whether it is a dynamic creative, and how many text variants it is testing

None of this text changes a single number. Its job is to answer the next question a
human always asks. Once the report says "the cart step is your leak on this ad", you
immediately want to know *which ad, saying what, with which button*. That is what the
text and pictures are for: the numbers find the problem, the creative shows you what
the problem looks like.

**From the performance figures** — the counts that form the chain: how many people saw
it, clicked, reached the page, added to cart, started paying, and paid, plus the money
spent and made. Also how far into videos people watched, and Meta's own quality
rankings.

**Decoded from the media**, but only for the biggest spenders: still frames from the
video, a transcript of the audio, and labels for what is in the picture. This is the
slow, expensive part, which is why it is limited to the ads you are actually going to
read about.

### The metrics by name, with their sums

The five that decide the leak. These are the chain, in order — each one is the
percentage of people who survived that step:

| Metric | The sum | In plain words |
|---|---|---|
| **Link CTR** | `link_clicks / impressions x 100` | of everyone who saw it, how many clicked |
| **LPV rate** | `landing_page_views / link_clicks x 100` | of the clickers, how many actually saw the page load |
| **LPV to ATC** | `add_to_cart / landing_page_views x 100` | of the page viewers, how many put something in the basket |
| **ATC to checkout** | `initiate_checkout / add_to_cart x 100` | of the basket fillers, how many began paying |
| **Checkout to purchase** | `purchases / initiate_checkout x 100` | of those, how many actually paid |

Multiply all five and you have the share of viewers who bought. That is why the worst
one drags everything.

**What each step costs.** The same journey priced instead of counted, so you can see
where the money goes:

| Metric | The sum | In plain words |
|---|---|---|
| **CPM** | `spend / impressions x 1000` | cost to show the ad a thousand times |
| **CPC** | `spend / link_clicks` | cost of one click |
| **Cost per LPV** | `spend / landing_page_views` | cost of one person reaching the page |
| **Cost per ATC** | `spend / add_to_cart` | cost of one basket |
| **CPA** | `spend / purchases` | cost of one sale |
| **CPL** | `spend / leads` | cost of one enquiry |

**Money made.** Both are marked *proxy*, because they are Meta's own claim rather than
your books:

| Metric | The sum | In plain words |
|---|---|---|
| **ROAS** | `purchase_revenue / spend` | money back per rupee spent — **not** profit, it ignores what the product cost |
| **AOV** | `purchase_revenue / purchases` | average size of an order |

**Did the video hold anyone?** A small funnel of its own, inside the first few seconds:

| Metric | The sum | In plain words |
|---|---|---|
| **Hook rate** | `three_second_views / impressions x 100` | did the opening stop the scroll |
| **Hold rate** | `thruplays / three_second_views x 100` | of those it stopped, how many stayed 15 seconds |
| **ThruPlay rate** | `thruplays / impressions x 100` | of everyone, how many watched 15 seconds |
| **25 / 50 / 75 / 95 / 100% view rate** | `video_pXX_watched / video_starts x 100` | how far into the video people got |
| **Average watch time** | read straight from Meta | seconds watched on average |
| **Cost per ThruPlay** | `spend / thruplays` | cost of one 15-second watch |

**A few extras** that describe click quality rather than the chain itself:

| Metric | The sum | In plain words |
|---|---|---|
| **Outbound CTR** | `outbound_clicks / impressions x 100` | clicks that actually left Meta for your site |
| **Unique link CTR** | `unique_inline_link_clicks / reach x 100` | share of *people* who clicked, counting each person once |
| **Click to LPV loss** | `100 - lpv_rate` | share of clicks lost before the page appeared |
| **ATC to purchase** | `purchases / add_to_cart x 100` | basket straight through to paid |
| **LPV to lead** | `leads / landing_page_views x 100` | page views that became enquiries |

**And the ones that cannot be filled in.** These have real formulas, but the bottom
half of each sum lives in a system we are not connected to, so they show as *not
connected* rather than being quietly dropped:

| Metric | The sum | What is missing |
|---|---|---|
| **ATC rate (site)** | `add_to_cart / sessions x 100` | *sessions* — only Google Analytics counts visits |
| **Purchase rate (site)** | `purchases / sessions x 100` | *sessions* |
| **Bounce rate** | `bounced_sessions / sessions x 100` | Google Analytics |
| **Engaged session rate** | `engaged_sessions / sessions x 100` | Google Analytics |
| **Average engagement time** | read from Google Analytics | Google Analytics |
| **Return rate** | `returned_orders / orders x 100` | Shopify — Meta never sees a refund |
| **CAC** | `spend / new_customers` | Shopify — who is new versus repeat |
| **Lead to MQL** | `MQLs / leads x 100` | a CRM |
| **MQL to SQL** | `SQLs / MQLs x 100` | a CRM |

Note the pattern: everything Meta can see is computed, and everything that happens on
your own website or in your own books is not. That single line explains most of the
blanks in a funnel report.

### Why it sometimes refuses to answer

This is the part that surprises people. The report will often say *"no leak can be
called"* instead of naming one. That is deliberate. A confident wrong answer is worse
than no answer, so there are three ways an ad can fail to get a verdict:

- **Too little money spent.** Under about 300 rupees, results are luck, not evidence.
  The ad is set aside and checked again next time.
- **Too few events behind a number.** Two people out of two added to cart, so the ad
  scores 100 percent. True, and meaningless. Numbers like that get marked **thin**.
- **Nothing fair to compare against.** If only one other ad shares this ad's goal,
  then "the best" is just that one ad. The report says **one ad only** and softens
  the finding to "worth checking" rather than "this is the problem".

A useful way to read it: the code is trying to avoid telling you to fix something
that was never broken.

### What it does not decide

It never pauses or launches anything. It never guesses a missing number. When a step
needs data we do not have, it says which source is missing rather than filling the
gap with an average.

---

## 2. Glossary — every short form explained

### 2.1 Counting people and money

| Short form | Full name | What it actually means |
|---|---|---|
| **spend** | spend | Money paid to Meta for showing the ad. |
| **impression** | impression | One showing of the ad on one screen. If the same person sees it 3 times, that is 3 impressions. |
| **reach** | reach | How many *different people* saw it. Always smaller than impressions. |
| **frequency** | frequency | Average times each person saw it. `impressions / reach`. Frequency 3 means the average person saw the ad three times. |
| **CPM** | Cost Per Mille | Cost per **one thousand** impressions. "Mille" is Latin for thousand. This is the price of attention — lower is cheaper. |
| **CPC** | Cost Per Click | Money spent for each click. |
| **CPA** | Cost Per Acquisition | Money spent per **purchase**. Also called cost per action or cost per order. |
| **CPL** | Cost Per Lead | Money spent per **lead** (see 2.5). |
| **AOV** | Average Order Value | Average money per order. `revenue / orders`. |
| **ROAS** | Return On Ad Spend | Revenue divided by spend. ROAS 4 means ₹4 back for every ₹1 spent. **Not profit** — it ignores what the product cost to make. |
| **CTR** | Click-Through Rate | Percentage of impressions that led to a click. |

### 2.2 Clicks and the landing page

| Short form | Full name | What it actually means |
|---|---|---|
| **click** | click | Any click on the ad, including likes and profile taps. Not very useful. |
| **link click** | link click | A click on the actual link that goes to the website. This is the one that matters. |
| **LPV** | Landing Page View | The website page actually **finished loading**. Always fewer than link clicks, because people tap and then leave before the page appears. |
| **LPV rate** | landing page view rate | Of the people who clicked, how many actually saw the page. A low LPV rate usually means a slow website. |
| **click-to-LPV loss** | — | The opposite: the percentage lost between click and page load. `100 - LPV rate`. |
| **session** | session | One visit to the website. Comes from Google Analytics, **not** from Meta. |
| **bounce** | bounce | A visit where the person did nothing and left. |

### 2.3 The shopping steps

| Short form | Full name | What it actually means |
|---|---|---|
| **ATC** | Add To Cart | Person put the product in the shopping basket. |
| **IC** | Initiate Checkout | Person started the payment process (began filling the form). |
| **add payment info** | — | Person entered card details. Even closer to buying. |
| **purchase** | purchase | Person actually paid. |
| **purchase_revenue** | — | The money value of those purchases, as *Meta* reports it. |
| **checkout completion** | — | Of the people who started checkout, how many finished. |

### 2.4 Video words

| Short form | Full name | What it actually means |
|---|---|---|
| **3-second view** | — | The video was watched for at least 3 seconds. Meta's rough measure of "did this stop the scroll". |
| **hook rate** | — | Percentage of people who watched 3+ seconds. Measures whether the **opening** works. "Hook" = the first moment that grabs attention. |
| **ThruPlay** | ThruPlay | Meta's name for watching 15 seconds, or the whole video if it is shorter. |
| **hold rate** | — | Of the people the opening grabbed, how many stayed to 15 seconds. Measures whether the **middle** works. |
| **thumb-stop** | thumb-stop rate | Another name for hook rate — did the thumb stop scrolling. |
| **quartiles** | p25 / p50 / p75 / p95 / p100 | How many people reached 25%, 50%, 75%, 95%, 100% of the video. `p` = percent. |
| **VTR** | View-Through Rate | Percentage of impressions that became a video view. |

### 2.5 Lead generation words

Used by businesses that collect enquiries instead of selling online (insurance,
software, real estate).

| Short form | Full name | What it actually means |
|---|---|---|
| **lead** | lead | Someone filled in a form with their contact details. |
| **MQL** | Marketing Qualified Lead | A lead that marketing thinks is worth chasing. |
| **SQL** | Sales Qualified Lead | A lead a salesperson has confirmed is genuine. |
| **CAC** | Customer Acquisition Cost | Money spent to win one **new** customer. |

### 2.6 The three funnel stages

| Short form | Full name | Meaning | Judge it on |
|---|---|---|---|
| **TOF** | Top Of Funnel | Reaching brand-new people who do not know you. | Stopping the scroll — CPM, hook rate, CTR. **Never on ROAS.** |
| **MOF** | Middle Of Funnel | People deciding whether they want it. | Moving interest to cart — hold rate, LPV rate, LPV-to-ATC. |
| **BOF** | Bottom Of Funnel | People ready to buy. | Closing the sale — checkout rate, CPA, ROAS. |

Judging a TOF ad on ROAS is like blaming a shop's greeter for not running the till.

**How the code decides the stage.** It reads the campaign's objective and maps it
through a table you can edit in `stages.py`:

| Meta objective | Profile | Stage |
|---|---|---|
| `OUTCOME_AWARENESS`, `BRAND_AWARENESS`, `REACH`, `VIDEO_VIEWS` | awareness | **TOF** |
| `OUTCOME_ENGAGEMENT`, `POST_ENGAGEMENT`, `PAGE_LIKES` | engagement | **TOF** |
| `OUTCOME_TRAFFIC`, `LINK_CLICKS` | traffic | **MOF** |
| `OUTCOME_SALES`, `CONVERSIONS`, `PRODUCT_CATALOG_SALES` | sales | **BOF** |
| `OUTCOME_LEADS`, `LEAD_GENERATION` | leads | **BOF** |
| `OUTCOME_APP_PROMOTION`, `APP_INSTALLS` | app_promotion | **BOF** |

Traffic and engagement are marked **arguable** — they get a lower confidence score
and a `review_required` flag, because a traffic campaign can reasonably be run as
either top or middle of funnel.

### 2.7 Profit words (all currently unavailable — see Section 7)

| Short form | Full name | What it actually means |
|---|---|---|
| **COGS** | Cost Of Goods Sold | What the product cost you to make and ship. |
| **contribution margin** | — | What is left from revenue after COGS, shipping, fees and returns. |
| **contribution ROAS** | — | ROAS counting only that leftover money. The honest version of ROAS. |
| **MER** | Marketing Efficiency Ratio | Total business revenue divided by total ad spend, across all channels. |
| **nCAC** | new Customer Acquisition Cost | Cost to win a genuinely **new** customer, not a repeat buyer. |
| **LTV** | LifeTime Value | Total money one customer brings over their whole life. |
| **LTV:CAC** | — | LTV divided by CAC. Above 3 is usually considered healthy. |
| **payback** | payback period | How many months until a customer has repaid what they cost to acquire. |
| **marginal ROAS** | — | The ROAS of the *next* rupee you spend, not the average so far. |
| **incrementality** | — | Whether the sale would have happened anyway without the ad. |
| **holdout** | holdout test | Deliberately stopping ads in one region to compare. The only honest way to measure incrementality. |

### 2.8 Meta's building blocks

Meta organises advertising in four nested layers:

```
Ad Account   the billing container            id looks like act_674114890437719
  Campaign   holds the goal and the budget    id is a long number
    Ad Set   holds the audience and schedule
      Ad     the thing a person actually sees
        Creative   the picture or video plus the words
```

| Term | Meaning |
|---|---|
| **ad account** | The advertiser's account. Its id always starts with `act_`. |
| **objective** | The goal chosen at campaign level, e.g. `OUTCOME_SALES`, `OUTCOME_AWARENESS`, `OUTCOME_TRAFFIC`, `OUTCOME_LEADS`. Meta optimises delivery to that goal, so an ad can only be fairly compared with ads that share its objective. |
| **creative** | The reusable picture/video + text. Several ads can share one creative. |
| **image_hash** / **video_id** | Meta's internal ids for the picture or video file. |
| **catalog ad** | An ad that pulls products automatically from a product feed rather than a fixed image. |
| **effective_status** | Whether the ad is really running: `ACTIVE`, `PAUSED`, and so on. |
| **Ad Library** | Meta's free public archive of every live ad, used to study competitors. |

### 2.9 Technical words used in this codebase

| Term | Meaning |
|---|---|
| **Graph API** | Meta's web interface for programs. Every request is a URL like `https://graph.facebook.com/v20.0/act_123/insights`. |
| **insights** | The Graph API endpoint that returns performance numbers. |
| **actions array** | Insights does not return `add_to_cart` as its own field. It returns one list called `actions`, where each entry has an `action_type` and a `value`. The code searches that list by name. |
| **action_values** | The same idea for money instead of counts. |
| **time_increment** | `1` = give me one row per day. `all_days` = one combined row for the whole period. |
| **time_range** | The `since` and `until` dates. |
| **level=ad** | Return numbers per ad rather than per campaign. |
| **paging / cursor** | Meta returns long lists in pages; a cursor is the bookmark for the next page. |
| **LangGraph** | The library that runs the workflow as a chain of steps ("nodes"), passing one shared dictionary ("state") between them. |
| **Celery** | The background job runner. The web request returns instantly; Celery does the slow work. |
| **worker** | The Celery process that actually executes jobs. **It does not reload code — it must be restarted after changes.** |
| **broker / queue** | RabbitMQ, the waiting line jobs sit in until a worker takes one. |
| **run_id** | Our id for one execution of the workflow. |
| **task_id** | Celery's own id for the same execution. |

---

## 3. Where the code lives

### Backend — `app/workflows/creative_funnel/`

| File | Job |
|---|---|
| `state.py` | The shape of the shared dictionary passed between steps. |
| `stages.py` | Decides TOF / MOF / BOF for one ad, and records why. |
| `metrics.py` | The catalogue of all 31 metrics: formula, source, and whether it is available. |
| `diagnosis.py` | Compares ads with the same objective and names the weakest step. |
| `nodes.py` | The four steps of the workflow. |
| `graph.py` | Wires the four steps together in order. |

Supporting files:

| File | Job |
|---|---|
| `app/tasks/creative_funnel_tasks.py` | The Celery background job. |
| `app/routers/creative_funnel.py` | The HTTP endpoints. |
| `app/config/celery.py` | Must list the task module or the job is never registered. |

### Frontend — `imagive/src/components/CreativeAnalytics/Report/`

| File | Job |
|---|---|
| `utils/funnelData.js` | Formatting helpers and the narrative builder. |
| `sections/FunnelSummarySection.jsx` | Four headline cards plus the account verdict. |
| `sections/FunnelStageMixSection.jsx` | The TOF/MOF/BOF spend split bar. |
| `sections/FunnelAdsSection.jsx` | Per-ad creative preview, stage, reason, formulas. |
| `sections/FunnelLocksSection.jsx` | The "not connected" panel. |

---

## 4. How one run flows

```
pull_account_digest  ->  apply_spend_floor  ->  tag_and_compute  ->  diagnose_funnel
```

**1. `pull_account_digest`** — asks Meta for the account currency, then every
active ad, then the performance numbers for those ads. Same ingest as the
account-analytics workflow.

**2. `apply_spend_floor`** — throws out ads that barely spent anything. An ad with
₹200 of spend and 2 sales might look brilliant, but it is a coin toss, not
evidence. Default floor is **₹300** or **$5**, chosen by the account's currency.
Rejected ads are *held*, not deleted, and each one records why.

**3. `tag_and_compute`** — for every surviving ad, decide its funnel stage and
calculate all 31 metrics. Each metric comes back as a self-describing block:

```json
{
  "key": "lpv_to_atc",
  "label": "LPV to ATC",
  "stage": "MOF",
  "formula": "add_to_cart / landing_page_views x 100",
  "source": "META",
  "value": 3.0612,
  "inputs": { "add_to_cart": 300, "landing_page_views": 9800 },
  "status": "computed"
}
```

Because `inputs` and `formula` travel with the number, you can always recompute it
by hand: 300 ÷ 9800 × 100 = 3.06%.

**4. `diagnose_funnel`** — group ads by objective, find the account's own best
value for each step, then rank the steps by how far this ad falls short.

This workflow **skips media download and AI analysis entirely**, so it is fast and
costs nothing in AI fees.

---

## 5. Every formula, in plain English

`status` values: **computed** = real number, **proxy** = usable but imperfect,
**locked** = needs a data source we do not have, **insufficient_data** = the ad had
no such events.

### Attention (TOF)

| Metric | Formula | In words |
|---|---|---|
| CPM | `spend / impressions x 1000` | Price to show the ad a thousand times. |
| Hook rate | `three_second_views / impressions x 100` | Share of people the opening stopped. **proxy** — see Section 9, point 5. |
| ThruPlay rate | `thruplays / impressions x 100` | Share who watched 15 seconds. |
| Hold rate | `thruplays / three_second_views x 100` | Of those the opening grabbed, how many stayed. |
| 25/75/100% view rate | `video_pXX_watched / video_starts x 100` | How far into the video people got. **locked** — see Section 9, point 5. |

### Traffic quality

| Metric | Formula | In words |
|---|---|---|
| Link CTR | `link_clicks / impressions x 100` | Share of viewings that became a website click. |
| CPC | `spend / link_clicks` | Cost of one click. |
| LPV rate | `landing_page_views / link_clicks x 100` | Share of clicks where the page actually loaded. |
| Cost per LPV | `spend / landing_page_views` | Cost of one page view. |
| Click-to-LPV loss | `100 - lpv_rate` | Share of clicks lost before the page appeared. |
| Bounce rate | `bounced_sessions / sessions x 100` | **locked** — needs Google Analytics. |
| Engaged session rate | `engaged_sessions / sessions x 100` | **locked** — needs Google Analytics. |

### Shopping (MOF and BOF)

| Metric | Formula | In words |
|---|---|---|
| LPV to ATC | `add_to_cart / landing_page_views x 100` | Of people who saw the page, how many added to cart. |
| Cost per ATC | `spend / add_to_cart` | Cost of one add-to-cart. |
| ATC to checkout | `initiate_checkout / add_to_cart x 100` | Of people with a full cart, how many started paying. |
| Checkout to purchase | `purchases / initiate_checkout x 100` | Of people who started paying, how many finished. |
| ATC to purchase | `purchases / add_to_cart x 100` | Cart all the way to paid. |
| CPA | `spend / purchases` | Cost of one sale. |
| AOV | `purchase_revenue / purchases` | Average order size. **proxy** — Meta's figure, not real orders. |
| ROAS | `purchase_revenue / spend` | Revenue per rupee spent. **proxy** — not profit. |
| ATC rate (site) | `add_to_cart / sessions x 100` | **locked** — needs Google Analytics sessions. |
| Purchase rate (site) | `purchases / sessions x 100` | **locked** — needs Google Analytics sessions. |
| Return rate | `returned_orders / orders x 100` | **locked** — needs Shopify. |

### Lead generation

| Metric | Formula | In words |
|---|---|---|
| LPV to lead | `leads / landing_page_views x 100` | Page views that became enquiries. |
| CPL | `spend / leads` | Cost of one enquiry. |
| Lead to MQL, MQL to SQL | — | **locked** — needs a CRM. |
| CAC | `spend / new_customers` | **locked** — needs Shopify. |

**Totals: 31 metrics — 16 computed, 3 proxy, 12 locked.**

---

## 6. The five rules the code enforces

### 6.1 The spend floor

Nothing is scored until it has spent more than **₹300 / $5**. Small numbers are
noise, and noise must never reach a decision.

### 6.2 Compare like with like

An ad is only ever compared with ads that share its **objective**. A sales ad is
judged against other sales ads, never against an awareness ad, because Meta was
optimising them for different things.

### 6.3 The multiplying chain

```
ROAS = ( CTR x LPV_rate x ATC_rate x Checkout_rate x Purchase_rate x AOV x 1000 ) / CPM
```

Because these **multiply**, improving *any* one of them by 10% improves ROAS by the
same 10%. So the cheapest win is always the weakest link, which is usually a boring
website step rather than the video everybody argues about.

The code ranks five links it can measure from Meta alone:

```
link_ctr  ->  lpv_rate  ->  lpv_to_atc  ->  atc_to_checkout  ->  checkout_to_purchase
```

#### Reading the "Chain steps ranked" table

| Column | What it means |
|---|---|
| **Step** | Which link in the chain this row is about. |
| **Value** | This ad's own rate for that step. |
| **Own best** | The highest rate any *other ad with the same objective* reached in this run. The account competing against itself — never an outside benchmark. |
| **Objective avg** | The average across those same ads, for context. |
| **Gap** | How far below "own best" this ad sits, as a percentage **of own best**: `(own_best - value) / own_best x 100`. A gap of 75% means the ad achieves only a quarter of what the account's best ad achieves. |
| **Priority** | `gap x movability`. **Hidden in the UI right now**, because movability is 1.0 for every step, which makes priority an exact duplicate of Gap. The column reappears automatically once real movability weights are set. The highest row is the step to fix first either way. |

Two things "own best" is **not**: it is not an industry benchmark, and it is not a
target the ad must hit — it is simply proof that this account has already done
better on that step, so improvement is possible.

#### Why "own best" has a minimum volume

Taking the plain maximum is dangerous. An ad with 2 add-to-carts on 2 landing page
views scores 100%, and an ad where one person added three items to a cart after two
page views scores **150%** — a target no ad can reach. Every other ad then looks
catastrophically broken against it.

So an ad may only **define** the bar once its denominator is large enough:

| Step | Denominator | Minimum to set the bar |
|---|---|---|
| Link CTR | impressions | 5,000 |
| LPV rate | link clicks | 100 |
| LPV to ATC | landing page views | 100 |
| ATC to checkout | add to carts | 25 |
| Checkout to purchase | checkouts | 25 |

Ads below the minimum are still **scored** — they just cannot set the bar for
everyone else. If no ad qualifies, the bar falls back to the highest low-volume
value and is labelled **"weak bar"** in the table, never used silently.

Ranking formula:

```
gap      = how far below the account's own best, as a percentage
priority = gap x movability
```

`movability` means "how easy is this to change" — a 5-point gain on a landing page
is easier to win than the same gain on a video hook. Nobody has defined real numbers
for it yet, so every step uses **1.0**, which makes `priority` numerically identical
to `gap`. The value is still returned by the API so the assumption stays visible, and
the UI hides the duplicate column until the weights become real.

Note also that `gap` is a true percentage while `priority` is a plain score — once
movability stops being 1.0, priority is no longer a percentage of anything, which is
why only one of the two carries a `%` sign.

### 6.4 The materiality floor

A gap must exceed **10%** to be called a leak. Without this, an ad 0.2% below its
own best gets reported as broken.

### 6.5 The baseline trust gate

At least **3 ads** with the same objective must survive the spend floor. With only
one ad, "the best ad" is that ad itself, so every gap is zero and the answer is
meaningless. Below three, the report says so instead of inventing a verdict.

---

## 6A. Where each number comes from

Two different origins, and it matters when you want to change one.

**From the Yamin Tech Rulebook** — do not change these without changing the plan:

| Rule | Source |
|---|---|
| Spend floor ₹300 / $5 | Law 12 |
| Compare same-objective only | Law 13 and section 4C |
| TOF / MOF / BOF, and never judging TOF on ROAS | section 4.2 |
| The multiplying ROAS chain | section 5.4 |
| `LeverPriority = GapVsOwnBest x Movability` | section 5.4 |
| `mix_share = spend_on_x / total_spend x 100` | section 5.5 |
| Every funnel rate formula | sections 5D.6 to 5D.9 |
| Trust gates, and never substituting silently | section 8 |
| 55% confidence on Meta alone, 85% with GA4 | section 2.2 |

**Our own decisions** — the rulebook is silent on all of these, so they are project
choices, not plan requirements. Change them freely if evidence says otherwise:

| Setting | Value | Where | Why this value |
|---|---|---|---|
| Objective to stage map | see 2.6 | `stages.py` | Section 4.2 asks for objective + audience + creative cues, but never gives a mapping. Audience and creative cues need the AI decoder this workflow skips. |
| `own_best` = highest value among same-objective ads | — | `diagnosis.py` | The rulebook names "GapVsOwnBest" but never defines it per metric across ads. |
| `gap = (own_best - value) / own_best x 100` | — | `diagnosis.py` | The arithmetic behind "GapVsOwnBest" is not written down anywhere. |
| Materiality floor | 10% | `diagnosis.py` | Borrowed from section 5.5's "flag anything more than 10 points off", which is about **mix** gaps, not lever gaps. An extension, not a quotation. |
| Baseline minimum | 3 ads | `diagnosis.py` | Closest relative is section 8's "30+ ads for the account median, else use a fixed floor and flag it". Different metric, different number. |
| Benchmark volume floors | 5,000 impressions / 100 clicks / 100 LPV / 25 carts / 25 checkouts | `metrics.py` | Entirely ours. The rulebook has a **spend** floor only, and a spend floor does not stop a 2-checkout ad from setting a 100% bar. |
| `movability` | 1.0 for every step | `diagnosis.py` | Section 5.4 line 335 is the only mention of movability in the whole plan, with no numbers. |
| Stage-tag confidence | 80, or 60 when arguable | `stages.py` | Ours. |
| Hook rate numerator | the `video_view` action | `metrics.py` | `_INSIGHT_FIELDS` does not request a 3-second field, so this stands in. |

**One deliberate departure.** Section 2.1 assigns funnel step events to GA4. This workflow
reads them from Meta instead, because only Meta can attribute a funnel step to a
specific **ad**, which Law 4 ("point at the exact thing") requires. Every response
records `source: "META"` and caps confidence at 55% so the departure is never hidden.

---

## 6B. Every rule that decides an ad's funnel read

The exact version of Section 1A: the full decision chain, in the order it runs. Each step names the file it lives in,
so you can change one rule without hunting.

### Gate 1 — does this ad enter the report at all?

`nodes.py` · **the spend floor** (rulebook Law 12)

```
keep the ad only if  spend > floor
floor = 300 INR  |  5 USD  |  5 (any other currency)
```

Chosen by the account's own currency, which is read from Meta. Overridable per run
with `thresholds.min_spend`. Ads below the floor are **held, not deleted** — they are
never scored, never compared, and never allowed to influence another ad's numbers.
They are re-checked on the next run.

Law 12 measures spend over the **last 7 days**. This workflow measures it over the
requested window, so a longer window is more permissive than spec, and the run says
so in `warnings`.

### Gate 2 — does this ad get its creative decoded?

`nodes.py` · **the decode budget**

```
decode the top  thresholds.decode_top_n  ads by spend   (default 25)
  0   decode nothing, fastest run
 -1   decode everything
```

Only decoded ads get media download, video frames, transcript and crystals. **Every
ad still gets every metric** — funnel maths never needs a decoded creative. This
exists because the shared media and AI pipelines cap themselves at 5 and 3 concurrent,
so cost grows linearly with ad count.

### Gate 3 — which funnel stage is the ad in?

`stages.py` · two signals, strongest first.

**First choice: the ad set's optimization goal.** This is what Meta actually
delivers against, so it beats the campaign objective.

| Optimization goal | Stage |
|---|---|
| `REACH`, `IMPRESSIONS`, `AD_RECALL_LIFT`, `THRUPLAY`, `VIDEO_VIEWS`, `POST_ENGAGEMENT`, `PAGE_LIKES` | **TOF** |
| `LINK_CLICKS`, `LANDING_PAGE_VIEWS`, `QUALITY_CALL` | **MOF** |
| `OFFSITE_CONVERSIONS`, `VALUE`, `PURCHASE`, `LEAD_GENERATION`, `QUALITY_LEAD`, `APP_INSTALLS` | **BOF** |

**Fallback: the campaign objective**, mapped through the profile table in 2.6.

**Confidence attached to the tag:**

| Situation | Confidence | Review flag |
|---|---|---|
| Goal and objective agree | 92 | no |
| Goal and objective disagree — goal wins | 75 | **yes** |
| No goal available, unambiguous objective | 80 | no |
| No goal available, objective is `traffic` or `engagement` | 60 | **yes** |

The disagreement case is the useful one: a `OUTCOME_SALES` campaign whose ad set
optimises for `LANDING_PAGE_VIEWS` is genuinely a MOF ad set, and the objective
alone would have called it BOF.

### Gate 4 — is the metric computable?

`metrics.py` · every metric returns one of four statuses.

| Status | Meaning |
|---|---|
| `computed` | real number from Meta |
| `proxy` | usable but imperfect — `aov`, `roas`, `hook_rate`. The reason travels with it |
| `locked` | needs a source that is not connected. GA4, Shopify, CRM, or a missing Meta field |
| `insufficient_data` | the ad genuinely had no such events, or the denominator is zero |

`insufficient_data` is not a failure. An awareness ad has no add-to-carts, and saying
so is the correct answer.

### Gate 5 — is the ad's own value worth reading?

`metrics.py` · **the thin-data flag**

```
low_confidence = own denominator < min_denominator x 0.25
```

A rate can be arithmetically perfect and practically meaningless: 100 percent LPV
rate off 3 clicks. Those values still show, marked **`thin`**, with the count that
produced them. This judges the ad's own reading only.

### Gate 6 — may this ad set the account bar?

`metrics.py` · **the volume floor per metric**

An ad may only *define* "own best" once its denominator is large enough. Below the
floor it is still scored — it simply cannot become the target everyone is measured
against.

| Floor | Counted in | Metrics |
|---|---|---|
| 5,000 | impressions | `link_ctr`, `outbound_ctr` |
| 1,000 | impressions | `cpm`, `hook_rate`, `thruplay_rate` |
| 1,000 | video views | all five view rates, `avg_watch_time` |
| 1,000 | reach | `unique_link_ctr` |
| 1,000 | spend | `roas` |
| 250 | video views / thruplays | `hold_rate`, `cost_per_thruplay` |
| 100 | link clicks | `lpv_rate`, `cpc`, `click_to_lpv_loss` |
| 100 | landing page views | `lpv_to_atc`, `cost_per_lpv`, `lpv_to_lead` |
| 25 | carts / checkouts | `cost_per_atc`, `atc_to_checkout`, `checkout_to_purchase`, `atc_to_purchase` |
| 10 | purchases / leads | `cpa`, `aov`, `cpl` |

Without this, one ad with 2 carts on 2 page views scores 100 percent and becomes a
target nothing can reach. A 150 percent bar was a real bug this fixed.

### Gate 7 — is the bar itself trustworthy?

`diagnosis.py` · **the weak-bar flag**, three tests ORed together.

```
weak = no ad cleared the floor, so the bar fell back to a small ad
    OR fewer than 3 ads in the baseline
    OR largest denominator < 385     // ~ +/-5 points at 95 percent
```

Shown as **`weak bar`**, or **`one ad only`** when the baseline holds exactly one ad.
At n = 1 the report drops `own_best` and `average` entirely and emits
`single_ad_reference` instead — one ad is not a distribution, and printing a mean of
one number invites a false reading.

Remember the baseline is always **same-objective only** (rule 4C), so a small
objective group produces a thin bar even on a large account.

### Gate 8 — which step is the leak?

`diagnosis.py` · the chain, ranked.

```
link_ctr -> lpv_rate -> lpv_to_atc -> atc_to_checkout -> checkout_to_purchase
```

```
gap      = (own_best - value) / own_best x 100     // cost metrics invert
priority = gap x movability                        // movability = 1.0 everywhere
```

The top row is the step to fix. See 6.3 for why `priority` is hidden while
movability is uniform.

### Gate 9 — is the leak worth reporting?

`diagnosis.py` · **all three must hold** before an ad is called leaking:

```
material = priority >= 10 percent          (thresholds.min_material_gap_pct)
       AND baseline has 3 or more ads
       AND the bar is not flagged weak
```

Fail any one and the ad reports **Hold** with the reason why. Three different
wordings, so the failure is never silent:

- **thin baseline** — "no leak can be called: only N ads in the baseline…"
- **weak bar** — "looks like the weakest step… but the bar itself is not
  trustworthy. Treat this as a direction to check, not a finding."
- **under the floor** — "no step is materially leaking… under the 10 percent
  materiality floor. Hold."

### Gate 10 — the account verdict

`diagnosis.py` · only ads that passed Gate 9 count. They are grouped by their
weakest step and ranked by **the spend sitting behind that step**, so the headline
names the leak costing the most money, not the largest percentage.

Ads with no material leak are counted separately and reported, never dropped.

---

## 7. Why some numbers say "not connected"

Meta only knows what happens **on Meta**. It stops knowing at the click. Four other
sources are needed for the rest, and none is connected:

| Missing source | What only it can tell us | Metrics blocked |
|---|---|---|
| **GA4** (Google Analytics 4) | sessions, bounces, time on page | 5 |
| **Shopify** | real orders, refunds, stock, new vs repeat customers | 2 |
| **Finance sheet** | COGS, shipping, fees — a typed spreadsheet, no API exists | contribution margin and contribution ROAS |
| **CRM** | MQL and SQL stages | 2 |
| **Holdout test** | whether the sale would have happened anyway | incrementality |

Locked metrics are **listed, not hidden**. A number quietly missing looks like a
number that does not matter, and the rule is: never substitute silently.

Because of this, funnel confidence is capped at **55%**. Connecting GA4 would raise
it to about 85%.

---

## 8. Endpoints and how to test

### 8.1 The endpoints

| Method + path | Purpose |
|---|---|
| `GET /api/v1/creative-funnel/catalog` | Every metric with its formula and lock. No account needed — good first call. |
| `POST /api/v1/creative-funnel/preview` | Runs immediately and returns the result. No background job. For testing. |
| `POST /api/v1/creative-funnel/runs` | Queues a background job. |
| `GET /api/v1/creative-funnel/runs/{run_id}` | Check progress or fetch the result. |

The user interface does **not** call these. It goes through Laravel, which forwards
to the shared `/api/v1/creative-analytics/runs` endpoint with
`workflow_name: "creative-funnel"`.

### 8.2 Test it

```bash
curl -X POST 'http://127.0.0.1:8000/api/creative-analytics/runs' \
  -H 'Accept: application/json' -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  --data-raw '{
    "workflow_name": "creative-funnel",
    "facebook_id":   "<facebook account id>",
    "meta_account_id": "act_674114890437719",
    "campaign_ids":  [],
    "objectives":    ["OUTCOME_SALES"],
    "include_paused_campaigns": false,
    "include_catalog_ads": true,
    "thresholds":    { "min_impressions": 1000, "min_spend": 100 },
    "reporting_window": "custom",
    "start_date": "2026-07-20",
    "end_date":   "2026-08-20"
  }'
```

Then poll `GET /api/creative-analytics/runs/{run_id}` until `status` is `completed`.

**Use `OUTCOME_SALES` with at least 3 ads.** An awareness run produces almost
nothing, because awareness ads never generate cart or checkout events — every
shopping metric correctly comes back `insufficient_data`.

---

## 9. Things to know before changing this

1. **Restart the Celery worker after any code change.** Workers load code once at
   startup. A new task also has to be added to `imports` in `app/config/celery.py`
   or it is never registered at all.
2. **Laravel and Python must share one database.** Python writes the run row;
   Laravel reads it. Pointed at different databases, every status check returns
   "run not found".
3. **Laravel whitelists workflow names** in four request classes under
   `app/Http/Requests/CreativeAnalytics/`. A new workflow must be added to all four.
4. **Percentages are already scaled 0-100.** The shared `fmtPercent` helper
   multiplies anything below 1 by 100, which would turn a real 0.8% into 80%. Funnel
   code uses `fmtScaledPercent` instead.
5. **Two known gaps in the Meta request.** `_INSIGHT_FIELDS` in
   `app/integrations/meta_ads/queries/creative_analytics/fetchers.py` does not ask
   for the video quartile fields, so those stay locked; and hook rate currently uses
   the `video_view` action as a stand-in for 3-second views. Verify the exact field
   name against your pinned API version before relying on it.
6. **Funnel stage comes from the objective only.** The full specification wants
   objective *plus* audience *plus* creative cues; the last two need the AI decoder,
   which this workflow does not run. Every tag therefore carries its own confidence
   and a `review_required` flag.
7. **This puts the funnel on Meta data.** The written plan assigns funnel steps to
   GA4. Building on Meta was a deliberate choice, because only Meta can attribute a
   funnel step to a specific **ad**. Every response records `source: "META"` and the
   55% confidence so the departure is visible.
