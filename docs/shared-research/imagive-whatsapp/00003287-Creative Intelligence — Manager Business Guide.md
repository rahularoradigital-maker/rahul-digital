# Creative Intelligence — Manager Business Guide

**Audience:** Account managers, media leads, and creative leads  
**Purpose:** Explain what the Creative Intelligence report is doing, how it judges an account, and which rules it follows before it recommends an action  
**Tone:** Business logic only. This is not a technical spec.

---

## 1. What this product is

Creative Intelligence is a **daily read of one Meta ads account**.

A manager should be able to open it, spend about ninety seconds, and leave knowing four things:

1. **What state the account is in right now**
2. **What will break next, and how soon**
3. **What to do today**
4. **What the creative team should shoot next**

It is a story, not a pile of charts. Each section answers the question the previous section raised.

The product is **read-only**. It never pauses, scales, or edits ads inside Meta. The manager still makes the live decision. The screen records the manager’s choice so the team can later see whether that choice helped.

---

## 2. What this product is not

Keep these limits in mind while reading any report:

- It does **not** change campaigns, budgets, or ads on Meta.
- It does **not** forecast revenue or ROAS. Money numbers are **weekly spend that would move** if the recommended actions were taken, not a promise of better returns.
- It does **not** compare this brand to competitors. Share of voice is not available because the report only sees this brand’s own ads account.
- It does **not** mix sales ads and engagement ads into one ranking. Different objectives are different jobs.
- It does **not** invent certainty. If the evidence is thin, it says so, withholds the claim, or lowers the priority of the recommendation.

If the report cannot honestly support a claim, it refuses to say it. That honesty line is a feature, not a gap.

---

## 3. How to read the screen (the intended flow)

Read top to bottom. Jump with the section nav only after the first pass.

| Order | Section | Question it answers |
|---|---|---|
| 1 | The rules of this read | What period, which ads, and what was left out? |
| 2 | The verdict | What is the one thing I need to know? |
| 3 | Account health | How healthy is the scored set, in one glance? |
| 4 | Five reads | Where is the damage sitting? |
| 5 | How concentrated you are | Are we too dependent on a few winners? |
| 6 | What breaks next | What becomes a problem, and by when? |
| 7 | Do this today | What should I act on now? |
| 8 | Money on the table | Where is weekly spend being wasted? |
| 9 | Creative leaderboard | Which actual ads are we talking about? |
| 10 | What is overused, and what to make next | Which creative ingredients are winning or losing? |
| 11 | What to shoot next | What should the next brief contain? |
| 12 | What we could not check | Where should I not over-trust this report? |
| 13 | Decision history | What did we decide last time, and did it help? |

The sticky bar at the bottom keeps the live decision state in view: how many cards are decided, how many are still waiting, how much weekly money would move if remaining cards were accepted, and a reminder that **nothing launches on its own**.

---

## 4. How a report is produced (the method)

Every Creative Intelligence run follows the same business method.

### Step 1 — Pull the live account

The system reads the connected Meta ads account for the chosen date window. It pulls:

- Active ads and their creatives
- Performance for the window
- Day-by-day delivery, where available
- Placement mix and recent account activity, where available

It does not pull competitor libraries, landing-page health, stock, or tracking changes.

### Step 2 — Decide which ads are fair to judge

Not every live ad is scored. An ad must clear the **reporting floor** before the system will treat it as evidence:

- Enough impressions to be real delivery, not noise (default: 1,000)
- Enough spend to be a real test (default: 100 in the account currency)
- Enough days live to not be a launch flicker (default: 3 days)

Ads below the floor still appear in the account, but they are marked **out**. The report tells the manager how many were fetched, how many cleared the floor, how many were scored, and how many are still too new.

**Rule:** do not kill or scale an ad that has not had a fair chance to prove itself.

### Step 3 — Read the creatives

Each scored creative is tagged for ingredients the team can actually change:

- Hook
- Offer
- Copy style
- Colour palette
- Setting / environment
- Mood
- Talent look
- Audio
- Format

These tags are the “creative DNA” of the library. They are how the system later says “this hook is overused” or “this offer is losing.”

### Step 4 — Score three independent views of every ad

Every eligible ad is judged on three separate questions:

1. **Is it performing?** Scale, watch, or pause versus other ads with the **same objective**.
2. **Is it tired?** Keep, watch, refresh, rotate, or act now.
3. **Is the library repeating?** Dominance, near-copies, and concentration.

Those three views are then combined into **one named state** per ad. That state is what later becomes a recommendation.

### Step 5 — Name the most likely cause

The system does not stop at “this ad is weak.” It walks a cause ladder and names the first cause that fits. If a more expensive wrong diagnosis would be claimed (for example “the audience is used up” when the real problem is creative repetition), that claim is **withheld**.

### Step 6 — Run named checks

The account is then put through a fixed board of business checks. Each check is a pass or fail against a published line. The headline score on the report is simply: **how many of those counted checks passed**.

### Step 7 — Rank what to do today

Findings become action cards. Cards are ranked by how severe the problem is, how much spend sits on it, how confident the evidence is, and how urgent the timing is. Hard safety rules can promote or demote a card after that ranking.

### Step 8 — Write the next creative briefs

Where winners are wearing out or a winning pattern is overused, the report writes a shoot brief: what to keep, what to change, what to avoid, how many variants, and how soon.

---

## 5. Ground rules of every read

These rules sit at the top of the report because the rest of the story is only as good as the sample.

### 5.1 Date window

The report is always for a named date range. Numbers are for that window, not “all time.”

### 5.2 Objective scope

Ads are compared only to peers with the same job (sales with sales, traffic with traffic, and so on). If the account mixes objectives, the report says so and **does not pretend those ads share one ranking**.

### 5.3 Currency

Money is shown in the ad account currency. Waste, weekly spend, and “money that moves” all use that same currency.

### 5.4 Too new to judge

An ad younger than **7 days** is protected. The system will not recommend pausing it yet, even if early numbers look weak. Launch spikes are also treated with caution: an early peak followed by a fade is not automatically a winner to scale.

### 5.5 Confidence of the whole report

The report has a confidence ladder for the account, not just for one ad:

| Level | What it means in practice |
|---|---|
| Too little signal | Not enough eligible ads or no usable performance window. Do not treat the verdict as a firm diagnosis. |
| Usable, but tags are thin | Day-by-day data exists, but less than 90% of the library is tagged. Pattern calls are weaker. |
| Strong | Day-by-day data exists and at least 90% of the library is tagged. Pattern and diversity calls are trustworthy enough to act. |
| Benchmark-grade | Strong, plus a window of at least 60 days and 30 or more eligible ads. Best for comparing against longer history. |

The report will also tell the manager what would raise confidence (for example: tag more creatives, widen the window, or wait until more ads clear the floor).

### 5.6 First run versus later runs

The first completed run has no history to compare against. The screen shows a calm first-read state instead of fake trend arrows. From the second comparable run onward, the five diagnostic cards can show whether things got better or worse.

---

## 6. Section-by-section: what each block is doing

### 6.1 The rules of this read

**Business job:** tell the manager what this report covers before any judgement is shown.

It states:

- How many days were analysed
- Which objectives are in scope
- Currency
- How many ads were fetched
- How many cleared the reporting floor
- How many were scored
- How many are too new
- Whether mixed objectives make a single ranking unsafe

**“Why X are out”** opens the list of ads that did not clear the floor. This is transparency, not a failure of the product.

**Manager use:** if most ads are out, do not over-act on the verdict. The sample is thin.

---

### 6.2 The verdict

**Business job:** one sentence that contains the plan.

The sentence always has two parts:

1. **The account state** — for example “creatives are repeating,” “creatives are wearing out,” “the auction moved against you,” or “not enough signal yet.”
2. **The plan counts** — how many scored ads to scale, stop, and brief, plus the weekly spend that would move off stop ads onto scale winners and new briefs.

Beside the sentence sit:

- Action chips (stop / consolidate / refresh / scale / brief)
- **Moves this week** — weekly spend attached to recommended moves
- **Waste** — weekly spend sitting in loss buckets
- **Runway** — how many days until more spend lands on tired or burnt ads
- A dark score card: **X of Y checks green**

**Honesty line:** if the system refused a claim, it says so in plain language. The most common honesty line is:

> We did not claim the audience is used up. Repetition is the cheaper problem to fix.

**Manager use:** treat the sentence as the meeting opener. The chips are the agenda. The score card is how confident the diagnosis is, not a second verdict.

**Important money rule:** the product does **not** model how much ROAS or revenue will improve. It only models weekly spend that would be reallocated.

---

### 6.3 Account health

**Business job:** a compact strip under the verdict so the manager can see whether the scored set is even worth debating.

It shows:

- Current account return from completed ads in this window (not a forecast)
- Check health as a percentage of counted checks that passed
- How many ads were scored

**Manager use:** if check health is low, go to Five reads next. If almost no ads were scored, fix the sample before arguing about tactics.

---

### 6.4 Five reads

**Business job:** split the one verdict into five diagnostic pillars so the manager knows where to look.

The five cards are:

1. **Creative analytics** — are we spending on the right ads and patterns?
2. **Creative fatigue** — are live creatives wearing out?
3. **Creative diversity** — is the library repeating itself?
4. **Exposure** — how hard is the same audience being hit?
5. **Concentration** — are too few winners carrying the account?

Each card has:

- A status word (healthy / watch / danger, or concentration’s own band)
- One primary number
- One plain sentence
- **Open** for the working paper
- **Why** for the evidence behind the card

**How a read card gets its status:**

| Status | Meaning |
|---|---|
| Healthy | Every counted check on that card passed |
| Watch | One to three counted checks failed |
| Danger | Four or more counted checks failed, **or** any single critical check failed |

Critical checks are the ones the business cannot ignore (for example: too much spend already sitting on pause-worthy ads, fatigue data missing, act-now spend already material, or diversity judged severe).

**Manager use:** start work in the reddest pillar. Do not try to fix everything at once.

The full check catalogue is in **Section 8**.

---

### 6.5 How concentrated you are

**Business job:** show portfolio fragility, which is different from fatigue.

A creative can still be working and still be dangerous if too much spend sits on too few winners. If one of those ads turns, a large share of the account turns with it.

The card shows:

- A concentration score out of 100
- A sentence naming the dependency
- The most spend-heavy creatives
- Why

**Bands the manager will see:**

| Score | Reading |
|---|---|
| Below 40 | Spend is reasonably spread |
| 40 to 69 | Watch — a few ads are starting to dominate |
| 70 and above | Tight — the account is dependent on a small set of winners |

**Manager use:** concentration usually means **consolidate and brief replacements**, not “pause the winners.” Killing the only working ads makes the account worse.

---

### 6.6 What breaks next

**Business job:** put dates on fatigue and exposure so the queue is not guesswork.

The section groups ads into:

- **Already past half life** — the creative has already crossed the safe-exposure mark
- **Crossing inside 7 days** — on current trajectory, they will cross soon

Each row carries timing, the ad, the reason, and the weekly spend at stake. A supply-cliff view shows how much weekly spend hits the refresh wall at 0, 7, 14, and 30 days.

**Half life, in business language:** every person can only see the same ad so many times before it stops working. The report uses a Meta-style frequency curve. When an ad is about halfway through that useful life, it is marked past half life. That is a scheduling problem, not a moral judgement of the creative.

**What this section will not do:** it will not forecast ads that fail the noise guards (too few continuous days, too little daily delivery, or a slope so small it is just noise). Missing a row here means “we refused to guess,” not “this ad is safe forever.”

**Manager use:** this is the calendar for refresh and rotate. The action queue below is ordered with this timing in mind.

---

### 6.7 Do this today

**Business job:** turn diagnosis into ranked instructions.

Each card is one instruction with:

- An action type
- A plain-language headline
- Why this ad or pattern is here
- Weekly money attached
- Confidence
- Decision controls

**Action types the manager will see:**

| Action | What the business should do |
|---|---|
| Stop | Turn the ad off. It is burning spend without a fair reason to keep it. |
| Rotate | Take this version out of rotation; a sibling or new take should replace it. |
| Refresh | The ad is still working, but exposure is climbing. Brief a new take. |
| Consolidate | Too many near-copies or too much spend on one winner. Keep the strongest, stop the rest. |
| Scale | This ad is a fair winner and is not tired. Give it more budget in a step, not a dump. |
| Brief | The pattern is proven but overused, or a winner is wearing out. Shoot new variants. |
| Continue | Do not disturb. Hold the line. |
| Review | Look again; the system does not have enough to instruct. |

**Priority bands:**

| Band | Meaning for the working day |
|---|---|
| P0 | Do these first. Hard overrides can force a card here. |
| P1 | Do these today if P0 is handled. |
| P2 | This week, unless evidence is weak. |
| P3 | Background. Often underpowered patterns or low-confidence items. |

The cockpit shows the top cards. The rest live in the full queue.

**Blocked cards:** a Stop or Rotate on an **above-average ad** stays blocked until a replacement brief exists. The business reason is simple: do not kill a working ad unless the next shoot is already defined. The manager can still **approve anyway**, which is recorded as an override.

**Manager use:** decide in the product. Accept, dismiss, snooze, or override. Nothing is sent to Meta automatically.

---

### 6.8 Money on the table

**Business job:** group recoverable waste into themes, not another list of ads.

Each bucket has a weekly amount, an ad count, a one-line fix, and a way to send that fix into the queue.

**Rule that matters:** each ad is counted in **only one** waste bucket. The first matching bucket wins, in this order:

1. Spend on fatigued creatives
2. Budget trapped in near-copies
3. Spend with zero results
4. Spend below the data floor
5. Spend on losing patterns
6. Spend on launch spikes

That order is the de-duplication rule. A tired near-copy with no results is counted as fatigued spend, not three times.

**Manager use:** this is the money conversation with the client. The queue is the operating list. Use “send fix to queue” to jump from a waste theme to the exact cards.

---

### 6.9 Creative leaderboard

**Business job:** put faces on the analysis.

Each card shows the actual creative, a readable nickname, slot (top / rising / steady / dying / burnt / too new), weekly spend, results, cost per result, days live, and a fatigue line.

**Manager use:** never brief a pause from a table of file names. Confirm the creative visually here first.

---

### 6.10 What is overused, and what to make next

**Business job:** explain the ingredients behind the ads.

Winning patterns sit on one side. Losing patterns sit on the other. A pattern is a repeated creative ingredient (a hook, an offer, a setting, a format, and so on) that is either beating or losing to same-objective peers.

**How a pattern is classified:**

| Pattern reading | Meaning |
|---|---|
| Proven, still has room | Winning, not overused, and enough ads behind it to act |
| Wins, but overused | Winning, but that ingredient already dominates the library |
| Tired | Winning, but the ads behind it are fatigued |
| Losing | Losing against peers, and not dominating the library |
| Losing and overused | Losing **and** still being repeated too much |
| Underpowered | The sample is too small (fewer than 3 eligible ads). Do not scale or kill from this alone |

**Manager use:** preserve winning ingredients, change the overused ones, and stop feeding losing ones. This section is the input to the briefs below.

---

### 6.11 What to shoot next

**Business job:** hand the creative team a recipe, not a mood board.

A brief is written when:

- A winning pattern is overused, tired, or still has room and needs more variants, **or**
- A winning ad is wearing out and is not already covered by those patterns

Each brief tells the team:

- What to **preserve** (the ingredient that is working)
- What to **change** (up to two overused dimensions, so the new shoot is actually different)
- What to **avoid** (losing ingredients)
- Format and concept
- How many variants (between 1 and 4, based on how many current ads in that set are already at risk)
- How soon it is needed
- How much weekly spend this brief is protecting
- Which queue cards it unblocks

**Manager use:** send the brief to creative. Do not rewrite it into a generic “we need more UGC.” The preserve / change / avoid lines are the whole point.

---

### 6.12 What we could not check

**Business job:** disclose blind spots so the report stays trusted.

The product never claims it inspected:

- Measurement health
- Tracking changes
- Landing-page changes
- Stock status
- Offer changes on site

If delivery looks worse after a tracking or page change, this report may still look like a creative problem. The watchouts exist so the manager asks those questions outside the tool.

---

### 6.13 Decision history

**Business job:** keep the team honest over time.

Every accept, dismiss, snooze, override, and undo is stored. About 30 days later the product looks at whether the ads involved got better, worse, or stayed stable. That is how the team learns whether following (or ignoring) the queue helped.

This is not a live Meta change log. It is the team’s own decision ledger.

---

## 7. How every ad is classified (the method behind the queue)

Before any check or card exists, each eligible ad is given three labels, then one combined state.

### 7.1 Performance bucket (analytics)

Compared only to same-objective peers:

| Bucket | Business meaning |
|---|---|
| Scale | Beating the peer set. Candidate to give more budget, if not tired. |
| Watch | Neither clearly winning nor clearly failing. |
| Pause | Losing to the peer set. Candidate to stop, if it has had a fair run. |

### 7.2 Fatigue verdict

| Verdict | Business meaning | Typical timing |
|---|---|---|
| Keep | Healthy. Leave it. | About 30 days of runway |
| Watch | Early wear. Monitor. | About 30 days |
| Refresh | Still working, but due a new take. | About 14 days |
| Rotate | Take this version out. | About 7 days |
| Act now | Immediate trouble. | Today (0 days of runway) |

An ad is treated as **at risk** once its fatigue reading crosses the risk line (40% of the fatigue scale).

### 7.3 Combined ad state (first matching rule wins)

The system walks this list from the top and stops at the first match. That is why one ad never has two conflicting instructions.

| Order | Combined state | What it means | Default action |
|---|---|---|---|
| 1 | Too new to score | Below the reporting floor, or not eligible | Review |
| 2 | Do not pause yet | Live fewer than 7 days | Continue |
| 3 | Spending with no results | Burning spend with no results | Stop (forced top priority) |
| 4 | Past half life | Exposure has already crossed the safe mark | Rotate |
| 5 | Winner wearing out | Scale-worthy **and** tired | Refresh / brief a replacement |
| 6 | Winner carrying too much spend | Scale-worthy **and** concentrated | Consolidate |
| 7 | Near copies | At least 3 visually similar ads sharing the load | Consolidate |
| 8 | Ready to scale | Scale-worthy, not tired, not a launch spike | Scale |
| 9 | Weak, but not tired | Pause-worthy and not fatigued | Stop |
| 10 | Weak and tired | Pause-worthy and fatigued | Stop |
| 11 | Hold steady | None of the above | Continue |

**Manager takeaway:** a tired winner is not a pause. A weak ad that is only 4 days old is not a pause. A winner carrying two-thirds of spend is a concentration problem, not a celebration.

---

## 8. The check board — every check, in business language

The dark score on the verdict is built only from **counted** checks on four cards: Analytics, Fatigue, Diversity, and Exposure. Concentration is a fifth read on the screen, but it is scored from its own concentration grade, not added into that X of Y number.

A check can be:

- **Green** — the account is on the safe side of the line
- **Red** — the account has crossed the line
- **Withheld** — the check exists, but the system refused to count it because a stronger honesty rule applied
- **Visible but not counted** — money diagnostics shown for context, not added to the headline score

**Headline score method:**

1. Ignore withheld checks
2. Ignore informational money checks that are marked as not counting
3. Count the rest
4. Green = counted checks that passed
5. Total = all counted checks
6. Add green and total across Analytics + Fatigue + Diversity + Exposure

A typical full board has **38 counted checks**. A run can show **37** when the “audience looking used up” check is withheld.

---

### 8.1 Analytics checks (9 counted + 3 money diagnostics)

These checks ask: are we putting money on the right ads and patterns?

#### Counted checks

**1. Too much spend on ads to pause**  
*Critical.*  
Fails when 20% or more of eligible spend sits on ads already judged pause-worthy.  
**Do:** move spend off those ads.

**2. Too many ads to pause**  
Fails when 3 or more eligible ads are in the pause bucket.  
**Do:** pause the weak set that has already been identified. Do not wait for a bigger post-mortem.

**3. Too much spend on ads to watch**  
Fails when 20% or more of eligible spend sits on shaky ads that are not yet kill-worthy.  
**Do:** review the watch set before it absorbs more budget.

**4. No ads ready to scale**  
Fails when the account has enough ads to judge (3 or more eligible) but **none** are in the scale bucket.  
Passes if there is at least one scale candidate, **or** the sample is too small to expect one.  
**Do:** find or launch a scale candidate before pushing more budget into the account.

**5. Losing patterns still live**  
Fails when one or more losing creative patterns are still active.  
**Do:** stop feeding those ingredients.

**6. Winning patterns too thin to act**  
Fails when a pattern looks winning but has fewer than 3 eligible ads behind it.  
**Do:** wait for more proof before scaling that ingredient.

**7. Creative tags cover the library**  
Fails when fewer than 90% of creatives are tagged.  
**Do:** tag more of the library; otherwise pattern calls stay weak.

**8. Ads below the reporting floor**  
Fails when one or more ads were excluded for lacking impressions, spend, or days.  
**Do:** simplify the active set or fund tests to the floor. Do not draw big conclusions from below-floor ads.

**9. Winners carrying too much spend**  
Fails when one or more winning ads are in the over-concentrated state.  
**Do:** spread spend; brief replacements for the load-bearing winners.

#### Visible but not counted (do not change the X of Y score)

- Weekly waste
- Spend with no results
- Spend on losing patterns

These exist so the manager can see the money, but they are not double-counted into the health score. The Money on the table section already owns that story.

---

### 8.2 Fatigue checks (11 counted, 1 of which can be withheld + 1 money diagnostic)

These checks ask: are live creatives wearing out?

**10. Fatigue scores are available**  
*Critical.*  
Fails when day-by-day fatigue data is missing. If this fails, several later fatigue claims are also untrustworthy.  
**Do:** do not treat fatigue recommendations as hard until a run with daily insights exists.

**11. Average fatigue is at risk**  
Fails when the spend-weighted average fatigue of eligible ads sits at or above the risk line (40%).  
**Do:** refresh or rotate the ads that are pulling the average up.

**12. Spend on ads that need action now**  
*Critical.*  
Fails when 5% or more of eligible spend sits on act-now ads. Those cards are also forced to top priority.  
**Do:** act on that set today.

**13. Ads that need action now**  
Fails if even one eligible ad is in act-now.  
**Do:** pause or replace those ads.

**14. Ads that need rotating**  
Fails if one or more ads are in rotate.  
**Do:** rotate them out.

**15. Too many ads due for a refresh**  
Fails when 3 or more ads are in refresh.  
**Do:** queue new takes; this is a production problem, not a media tweak.

**16. Too much spend on tired ads**  
Fails when 20% or more of eligible spend sits on ads already at fatigue risk.  
**Do:** cut spend on tired ads before fatigue spreads.

**17. Audience looking used up**  
Fails when the average audience-saturation reading is elevated.  
**Often withheld.** See Section 9. The system will not confidently blame “the audience is used up” at account level when the cheaper explanation is creative repetition, or when no winning pattern still has room.  
**Do:** if this check is withheld, fix repetition first. If it is counted and red, the audience really does look thin.

**18. Winners wearing out**  
Fails when one or more scale-worthy ads are also tired.  
**Do:** brief replacements for those winners. Do not pause them as if they were losers.

**19. Weak ads that are also tired**  
Fails when pause-worthy ads are also fatigued.  
**Do:** stop them. There is no remaining reason to keep them.

**20. Ads queued to replace**  
Fails when the fatigue model has clear top replacement candidates.  
**Do:** replace those first.

#### Visible but not counted

- Spend already past half life (this story belongs in What breaks next)

---

### 8.3 Diversity checks (12 counted)

These checks ask: is the library repeating one look, one hook, one offer, one format?

A creative ingredient **fails** when one value takes **70% or more** of the library (format uses a slightly stricter **75%** line, because format mix is a production choice).

**21. One copy style dominates**  
**22. One colour palette dominates**  
**23. One setting dominates**  
**24. One mood dominates**  
**25. One talent look dominates**  
**26. One audio style dominates**  
**27. One hook dominates**  
**28. One offer dominates**  
**29. One format dominates** (75% line)

**Do for all of the above:** introduce variety on that dimension in the next shoot. The brief builder will usually pick the most overused dimensions as the “change” lines.

**30. Near-copy cluster**  
Fails when the biggest lookalike cluster has **3 or more** ads. Near-copies split the same audience and fatigue together.  
**Do:** keep the strongest ad in the cluster; stop or differentiate the rest.

**31. Library concentration is moderate**  
Fails when overall diversity severity has reached moderate.  
**Do:** reduce repetition across the key dimensions, not just one ad.

**32. Library concentration is severe**  
*Critical.*  
Fails when severity is severe. This alone can put the Diversity card into danger.  
**Do:** rebuild variety. A severely repeating library is treated as a production emergency, not a media optimisation.

---

### 8.4 Exposure checks (6 counted)

These checks ask: how hard is the portfolio hitting the same people, and how close are ads to the end of useful life?

The portfolio exposure score is a blend of three things:

- How much spend sits on ads that are both tired **and** concentrated (overlap)
- How tired the spend-weighted average ad is
- How concentrated the library is

| Portfolio band | Score | Business reading |
|---|---|---|
| Healthy | Below 25 | Exposure is under control |
| Watch | 25 to 49 | Keep an eye on overlap and tired spend |
| Elevated | 50 to 74 | The same people are seeing too much of the same work |
| Critical | 75 and above | Exposure is the account problem |
| Unavailable | No score | Fatigue data was missing, so this score is refused |

**33. Portfolio exposure score is available**  
Fails when the score could not be calculated.

**34. Portfolio exposure is critical**  
Fails in the critical band.  
**Do:** reduce exposure on ads already late in life.

**35. Portfolio exposure is elevated**  
Fails in elevated or worse.  
**Do:** watch this before it turns critical.

**36. Audience overlap is elevated**  
Fails when the overlap component is at or above 50.  
**Do:** stop stacking tired, concentrated ads on the same people.

**37. Ads past their half life**  
Fails when one or more eligible ads have already crossed the safe-exposure mark.  
**Do:** replace them.

**38. Ads close to their limit**  
Fails when ads are near their projected end date (inside 7 days) or exposure and live fatigue disagree in a way that needs a watch.  
**Do:** watch those ads daily.

---

## 9. How the system names the cause (and when it refuses)

For every ad, the system walks a cause ladder **from the top**. The first matching cause wins. Later causes are not mixed in.

| Order | Named cause | What the manager should hear |
|---|---|---|
| 1 | Not enough data | Do not act. The ad has not earned a diagnosis. |
| 2 | Market drift | The auction got more expensive. This is not mainly a creative problem. Priority of creative actions is lowered. |
| 3 | Manual change volatility | Someone edited the account a lot, and performance moved the next day. Check the change log before blaming the creative. |
| 4 | Near-copy split | Similar ads are splitting the same audience. Consolidate. |
| 5 | Portfolio concentration | Too much spend on too few winners. Spread and replace. |
| 6 | Audience used up | People have seen this too much. **Often withheld** — see below. |
| 7 | Creative fatigue | The ad itself is tired. Refresh or rotate. |
| 8 | Creative quality | The ad is simply weaker than peers. Stop or rebuild. |
| 9 | Healthy | None of the problems above fit. Hold. |

### The honesty rule on “audience used up”

“The audience is used up” is an expensive wrong diagnosis. It pushes teams toward new targeting, new offers, or bigger media changes when the cheaper fix is usually **shoot something that does not look like the last twenty ads**.

So the account-level saturation claim is withheld when either of these is true:

1. The library is already moderately or severely repeating, **or**
2. There is no winning pattern that still has room — so the system cannot honestly say “the audience is finished; we just need more of the same.”

When withheld:

- The verdict prefers **“your creative is repeating”** over **“your audience is used up.”**
- The fatigue check “Audience looking used up” does not count toward the score.
- The honesty line on the hero explains the restraint.

**Manager use:** if you see that honesty line, brief new variety before you rebuild targeting.

### Causes the product never inspects

The ladder always admits it did not check measurement, tracking, landing page, stock, or on-site offer changes. If those moved, ask the web / tracking / ops owners. Do not let the report become the only explanation.

---

## 10. How “Do this today” is ranked

Every action card is scored from four ingredients, then safety rules are applied.

### 10.1 The four ingredients

1. **Severity** — how bad the named state is (zero-result burn is the worst; hold-steady is mild)
2. **Impact** — how much of eligible weekly spend sits on this finding. 20% of eligible spend is treated as a “full impact” event
3. **Confidence** — how strong the evidence is
4. **Urgency** — how soon it breaks (act-now is immediate; keep is not)

Higher combined score = higher on the working day list.

### 10.2 Hard overrides (these beat the math)

Applied after the score, in this spirit:

1. **Spend with no results** is always top priority.
2. **Act-now ads that already hold 5% or more of spend** are always top priority.
3. **Low confidence** cannot sit in the top two bands. Weak evidence is capped.
4. If fatigue data is missing, fatigue-dependent findings cannot sit in the top two bands.
5. If the named cause is market drift, creative action is capped. Do not “fix creative” for an auction problem.
6. A pattern with fewer than 3 eligible ads is demoted to background. Do not scale or kill from a thin sample.
7. Capacity: at most **6** top-priority cards, and at most **12** in the top two bands combined. Extra cards are demoted so the working day stays human.

### 10.3 Money attached to a card

- For most stop / rotate / refresh / consolidate cards, money is the **weekly spend** on those ads.
- For a scale card, money is a **30% step-up** of weekly spend, not the entire budget. The product is recommending a step, not a dump.
- Each ad is assigned to its highest-priority card. The same rupee is not promised twice.

### 10.4 Blocking until a brief exists

Stop or rotate on an above-average ad is blocked until a replacement brief is sitting on the report. That protects working spend from being killed with no next asset.

The manager may still override. That choice is stored as an override, not as a normal accept.

---

## 11. Decisions the manager can make

The product records a decision per card. It does not execute it on Meta.

| Decision | Meaning |
|---|---|
| Accept | The team will take this action outside the product. |
| Dismiss | The team rejects the recommendation. |
| Snooze | Revisit later (until a chosen date or the next run). |
| Approve anyway | Used on blocked cards. The manager accepts the risk of acting without a brief. |
| Undo | Reverses the last stored decision. The ledger stays append-only; undo is a new record, not an erase. |

About 30 days later, the product looks back at the ads on that card and grades the outcome:

| Later reading | Meaning |
|---|---|
| Acted and improved | The team followed the card and the ads got better |
| Acted and declined | The team followed the card and the ads got worse |
| Not acted and declined | The team ignored the card and the ads got worse |
| Not acted and stable | The team ignored the card and nothing much moved |
| Unknown | Not enough later data to judge |

**Manager use:** this is how the team learns which kinds of recommendations are worth following on this account. It is not a score of the manager.

---

## 12. What a healthy working day looks like

A practical rhythm for an account manager:

1. **Read the rules strip.** If most ads are out, stop. Fix the sample or wait.
2. **Read the verdict sentence and the honesty line.** That is the client-ready summary.
3. **Look at Five reads.** Pick the reddest pillar.
4. **Scan What breaks next.** Anything already past half life or crossing this week goes into today’s media work.
5. **Work Do this today from the top.** Accept, dismiss, or snooze. Do not leave P0 cards undecided.
6. **If winners are wearing out or a pattern is overused, send the briefs to creative the same day.** That is what unblocks later stop/rotate cards.
7. **Use Money on the table** only for the client money conversation, not as a second operating list.
8. **Check What we could not check** before you tell a client “it is definitely creative.”

If the account is repeating: **do not scale more of the same.** Brief variety.

If the account is concentrated: **do not pause the only winners.** Brief replacements, then consolidate.

If the auction moved: **do not redesign the creative first.** The report will have lowered those cards on purpose.

If ads are too new: **do not pause them.** The 7-day protection is there so the team does not kill tests.

---

## 13. Rules the product will not break

These are standing business rules. If a report seems to “miss” something, it is usually one of these:

1. **Nothing is sent to Meta automatically.**
2. **No ROAS or revenue improvement is invented.**
3. **Ads below the reporting floor are not used as proof.**
4. **Ads younger than 7 days are not paused.**
5. **Different objectives are not ranked as if they were the same job.**
6. **A pattern with fewer than 3 eligible ads is not an action.**
7. **Each ad is counted once in waste and once in the primary money assignment.**
8. **“Audience used up” is withheld when repetition is the cheaper explanation.**
9. **A tired winner is refreshed or briefed, not treated as a loser.**
10. **Stop/rotate on an above-average ad waits for a brief, unless the manager overrides.**
11. **The working day is capped.** The product will not dump 40 P0 cards on a manager.
12. **Blind spots are published.** Tracking, landing page, stock, and offer changes are out of scope.

---

## 14. Language cheat sheet

The screen avoids internal jargon. When a manager still sees a phrase, this is what it means:

| Phrase on screen | Plain meaning |
|---|---|
| Reporting floor | Minimum delivery before an ad is allowed to influence the diagnosis |
| Eligible | Cleared the reporting floor |
| Scored | Was fully judged |
| Checks green | Counted business rules that the account currently passes |
| Half life | The point where the same people have seen the ad enough that it is wearing thin |
| Runway | Days before more spend lands on tired or burnt ads |
| Near copies | Ads that look too alike and share an audience |
| Concentration | Too much spend depending on too few creatives |
| Waste | Weekly spend sitting in a loss theme; not a finance write-off |
| Money that moves | Weekly spend that would be reallocated if remaining cards were accepted |
| Brief | A shoot recipe for the creative team |
| Blocked | The product wants a replacement brief before it will recommend killing a working ad |
| Withheld | The product had a possible claim and refused to make it |
| First read | This is the first comparable run; there is no trend yet |

---

## 15. One-page summary for a new manager

Creative Intelligence reads one Meta ads account, drops ads that have not had a fair test, tags what the creatives actually look like, then asks five questions: are we spending on the right ads, are they tired, is the library repeating, is the same audience being over-exposed, and are too few winners carrying the account.

It turns those answers into one verdict sentence, a board of pass/fail checks, a dated list of what breaks next, a ranked action queue, a waste summary, and shoot briefs.

It will not pause ads for you. It will not promise a ROAS lift. It will not blame “the audience is used up” when the cheaper problem is that the account keeps shooting the same ad in a different filename.

The manager’s job in the product is to **decide**. The media and creative teams still do the live work. The report exists so those decisions are the same ones every morning, with the working shown, and with an honest list of what was not checked.
