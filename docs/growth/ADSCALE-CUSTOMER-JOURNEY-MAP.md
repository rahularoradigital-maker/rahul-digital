# AdScale — Customer Journey Map

_A strategic model of how a target buyer travels from "never heard of it" to "tells other buyers about it."
Emotions and pain points below are an analytical model for prioritisation, not measured data — validate them
with real interviews and product analytics before treating any as fact. Grounded in the actual AdScale product
(connects Meta + Google, reads day-wise data, returns a triple-labelled verdict, tells you what to act on
today, and never auto-applies a change) and the US B2B growth motion._

Date: August 2026 · Product: AdScale (adscaledigital.co) · Market: US B2B SaaS

---

## The persona (one specific traveller, not "a user")

**"Maya Chen — Senior Performance Marketer at a $12M/yr DTC brand."**

- Owns ~$180k/month across Meta + Google. Reports to a VP Growth who asks "why did ROAS drop?" every Monday.
- Not a data engineer. Lives in Ads Manager + a messy Google Sheet + a BI dashboard nobody trusts.
- Manages 6–12 active campaigns, 40–80 ads. Creative refresh is her bottleneck.

**Job to be done:** _"When I open my ad account each morning, help me know — in five minutes and with
confidence — the two or three changes that will actually move revenue, so I can defend them to my VP and not
waste spend while I sleep."_

**What she does NOT want:** another dashboard, a black-box "AI" that says "pause this" with no reason, or a
tool that auto-changes her account.

_(Secondary personas: the **agency media buyer** running 15 client accounts — same JTBD × 15, higher
switching cost; and the **DTC founder** who is the buyer but not the daily user.)_

---

## The journey at a glance

| Stage | Maya's one-line state | Dominant emotion | The make-or-break moment |
|---|---|---|---|
| Awareness | "Everyone's dashboard lies to me" | 😤 frustrated / skeptical | Sees a genuinely useful answer, not an ad |
| Consideration | "Is this just another dashboard?" | 🤨 guarded curiosity | Understands it *decides*, not just displays |
| Acquisition | "Let me connect and see MY numbers" | 😬 cautious | OAuth feels safe + read-only |
| Onboarding | "Show me something I didn't know" | 😲 → 😀 the aha | First correct, surprising, defensible verdict |
| Engagement | "This is my Monday-morning tab" | 🙂 reliant | The daily "what to do today" earns trust repeatedly |
| Retention | "I'd have to explain to my VP why I cancelled" | 😌 embedded | It catches a real problem she'd have missed |
| Advocacy | "You need to try this" | 🤩 evangelist | It makes her look smart to her boss / peers |

---

## Stage-by-stage

### 1. Awareness — "Everyone's dashboard lies to me"

- **Touchpoints:** a Reddit thread in r/PPC or r/FacebookAds ("why is creative fatigue hitting faster in
  2026?"), a Quora answer, a LinkedIn post from a respected buyer, an AI-search answer (ChatGPT/Perplexity)
  when she asks "how do I know if an ad is really fatiguing," a comparison blog, a YouTube teardown.
- **Actions:** searches a specific problem; skims; distrusts anything that smells like marketing.
- **Thoughts:** _"Is this person actually a buyer or a brand shilling a tool?" "Does this explain WHY, or just
  tell me to pause things?"_
- **Emotion:** 😤 frustrated with her current stack, skeptical of vendors.
- **Pain points:** vendor noise; generic "AI advertising" hype; nobody explains the *reasoning*.
- **Opportunity:** win on **usefulness before promotion** — an answer that teaches the materiality rule
  ("don't call fatigue on an ad that spent <20% of its ad-set budget") is worth citing *because it's true*,
  and AdScale is the natural footnote, not the headline. This is exactly the growth-agent's job.

### 2. Consideration — "Is this just another dashboard?"

- **Touchpoints:** adscaledigital.co, a comparison page ("AdScale vs a BI dashboard vs Ads Manager"), a demo
  video, an AEO answer that names AdScale as "the tool that gives a *reason* for every verdict."
- **Actions:** reads the homepage in 20 seconds; looks for proof it *decides*, not just charts; checks whether
  it touches her account (fear: "will it change my ads?").
- **Thoughts:** _"I already have dashboards. What does this DO that they don't?" "Will it break my account?"_
- **Emotion:** 🤨 guarded curiosity.
- **Pain points:** "dashboard fatigue"; can't tell it apart from BI tools; worried about write-access.
- **Opportunity:** lead with the **triple-labelled decision** (Evidence · Agreement · Confidence) and the
  "drafts only, never auto-applies" promise. The differentiator is *judgment with a reason*, not more pixels.

### 3. Acquisition — "Let me connect and see MY numbers"

- **Touchpoints:** signup, Meta/Google OAuth, the empty-state cockpit.
- **Actions:** signs up; connects Meta (the scary step); waits for the first sync.
- **Thoughts:** _"Is my data safe? Is this read-only? How long until I see something?"_
- **Emotion:** 😬 cautious — this is a **moment of truth**.
- **Pain points:** OAuth anxiety; time-to-first-value; "will it see my whole account?"
- **Opportunity:** make read-only + encrypted-token explicit *at the OAuth step*; show a progress state, not a
  spinner; get to the first verdict fast. (The product already encrypts tokens and never auto-acts — say so
  loudly here.)

### 4. Onboarding — "Show me something I didn't know" · **THE AHA**

- **Touchpoints:** the first cockpit load — the "what to do today" action queue, a verdict card with its three
  labels, the ad-set/campaign drill-in.
- **Actions:** reads the top action; checks whether it's *right* against her gut; expands the "why."
- **Thoughts:** _"Huh — it flagged that as 'not judgeable, spent only 4% of its ad set' … that's actually
  correct. A dashboard would've told me to kill it."_
- **Emotion:** 😲 → 😀 — **the aha moment**: a verdict that is correct, surprising, and *defensible*.
- **Pain points:** if the first verdict is generic or obviously wrong, trust dies instantly; too many actions =
  overwhelm; a verdict on a **paused/ended** campaign would break trust (now fixed — actions only on live ads).
- **Opportunity:** the **aha is a single correct, non-obvious, explained verdict.** Optimise onboarding around
  producing exactly one of those in the first 5 minutes — ideally one that saves money (a "stop wasting spend
  here, and here's the evidence" call she can act on and defend).

### 5. Engagement — "This is my Monday-morning tab"

- **Touchpoints:** the daily action queue, verdict cards, the ad-set/campaign metric drill-in, competitor
  intelligence, the creative studio, "Ask AdScale."
- **Actions:** opens it each morning; acts on 1–3 items; uses it to answer her VP; drills into an ad set to
  read frequency/reach/budget; pulls a competitor read before a launch.
- **Thoughts:** _"What changed overnight? What do I do first? Can I trust this number in front of my boss?"_
- **Emotion:** 🙂 reliant — becoming a habit.
- **Pain points:** if verdicts flip-flop day to day, trust erodes; if it nags about non-delivering ads or
  drowns her in low-confidence calls, she tunes out; stale data after a sync failure.
- **Opportunity:** **consistency + confidence tiers** are the retention engine. Show high-confidence calls
  boldly, hedge low-confidence ones honestly, and make the "why" one tap away every time. The
  **culprit-diagnostic** ("a paused campaign caused this week's drop") is a high-trust engagement moment.

### 6. Retention — "I'd have to explain to my VP why I cancelled"

- **Touchpoints:** weekly review, month-end reporting, a moment where AdScale caught something she'd have
  missed, billing.
- **Actions:** renews without thinking; expands to more accounts (agency); cites AdScale in her own reporting.
- **Thoughts:** _"This is now part of how I work. Cancelling means going back to the sheet."_
- **Emotion:** 😌 embedded.
- **Pain points:** **churn triggers** — a stretch of low-value or wrong verdicts; a big miss (it didn't catch a
  real ROAS collapse); a pricing change without matching value; a data-sync outage during a launch.
- **Opportunity:** engineer **one "it caught what I'd have missed" moment per month** and surface it explicitly
  ("this week AdScale flagged X before it cost you Y"). That single line is the renewal.

### 7. Advocacy — "You need to try this"

- **Touchpoints:** peer Slack/Discord groups, LinkedIn, agency referrals, a Reddit reply where *she* now
  recommends it (organically — the growth loop closing).
- **Actions:** recommends it to a peer; posts a before/after; an agency rolls it across clients.
- **Thoughts:** _"This makes me look sharp in front of my boss. I want my peers to have it (or not, if it's my
  edge)."_
- **Emotion:** 🤩 evangelist — **when it makes her look smart, she shares it.**
- **Pain points:** no easy way to share a specific verdict/insight; nothing in it for her to refer.
- **Opportunity:** make a **single verdict shareable** (a clean, credible "here's what AdScale caught" card),
  and give agencies a multi-account story. Advocacy is manufactured by making the user the hero, not the tool.

---

## Journey map table

| Stage | Touchpoint | User action | Emotion | Pain point | Opportunity |
|---|---|---|---|---|---|
| Awareness | Reddit/Quora/LinkedIn/AI-search answer | Searches a specific problem, skims | 😤 skeptical | Vendor noise; no *why* | Be useful first — teach the real rule, product as footnote |
| Consideration | Homepage, comparison page, demo | Reads in 20s, checks if it *decides* | 🤨 guarded | Looks like another dashboard | Lead with triple-label verdict + "drafts only" |
| Acquisition | Signup, Meta/Google OAuth | Connects account, waits for sync | 😬 cautious | OAuth fear; time-to-value | Read-only + encrypted said loudly; fast first verdict |
| Onboarding | First cockpit, action queue, verdict card | Reads top action, tests it vs gut | 😲→😀 **aha** | Generic/wrong first verdict kills trust | Engineer ONE correct, surprising, explained, money-saving verdict |
| Engagement | Daily queue, drill-in, competitor, studio | Acts on 1–3 items, answers VP | 🙂 reliant | Flip-flop verdicts; low-confidence noise | Consistency + honest confidence tiers + one-tap "why" |
| Retention | Weekly/monthly review, billing | Renews, expands accounts | 😌 embedded | A big miss; price↑ without value | One "it caught what I'd miss" moment/month, surfaced |
| Advocacy | Peer groups, LinkedIn, agency referral | Recommends, posts before/after | 🤩 evangelist | No shareable artifact | Make a single verdict shareable; agency multi-account story |

---

## Critical moments

- **Aha moment:** the first **correct, non-obvious, explained** verdict — ideally one that stops wasted spend.
  Not "here are your charts." Everything in onboarding should aim at producing this in ≤5 minutes.
- **Moments of truth:** (1) the OAuth connect ("is my data safe / will it change my account?"), (2) the first
  verdict ("is this actually right?"), (3) the first time she cites AdScale to her VP ("did it hold up?").
- **Churn triggers:** a run of low-value or wrong verdicts; a **verdict on a paused/ended entity** (now fixed);
  a missed real collapse; a sync outage during a launch; a price increase without a matching "value caught"
  story.

---

## Prioritised improvements

**Highest impact on conversion + retention (do first):**
1. **Onboarding = manufacture the aha.** Guarantee one correct, surprising, money-saving, *explained* verdict
   in the first session. This is the single biggest lever on activation → retention.
2. **Make "why" always one tap away.** The triple-label (Evidence · Agreement · Confidence) is the trust
   engine — never show a verdict without a reachable reason. Honest low-confidence hedging *builds* trust.
3. **The "it caught what you'd have missed" moment.** Detect and surface, monthly, one real save. This line is
   the renewal and the referral.

**Quick wins:**
4. Say **"read-only + encrypted, never auto-applies"** at the OAuth step, not buried in a FAQ — it defuses the
   biggest acquisition fear.
5. **Never point at a paused/ended entity as actionable** (done) — and add the **culprit-diagnostic** ("a
   paused campaign caused this drop") so dead entities appear only as *explanations*, never as chores.
6. A **shareable verdict card** — one clean, credible artifact she can drop in Slack/LinkedIn — turns happy
   users into the top-of-funnel of the growth loop.

**Deeper investment, biggest payoff:**
7. **The growth-intelligence loop** (your brief): listen to high-intent conversations → be useful → let real
   demand pull people into Awareness. The moat isn't more content; it's *understanding thousands of
   conversations and turning genuine demand into product + distribution.*
8. **Agency multi-account story** — the same JTBD × 15 accounts, with far higher switching cost and built-in
   advocacy (agencies sell their clients on the tools they use).

---

## How to use this

This is the analysis layer. For a visual board, recreate the Journey-map table in **Miro or FigJam** (stages
as columns, the six rows — touchpoint / action / emotion / pain / opportunity — as swimlanes, with an emotion
curve across the top). Then **validate every emotion and pain point with 5–8 real buyer interviews and your
product analytics** before treating any of it as fact — the model tells you where to look, not what is true.
