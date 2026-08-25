# AdBrain — Product Strategy Canvas

Date: 2026-08-25. Grounded in the current product (own-account action cockpit) and
`docs/DECISIONS.md`. India/D2C context is inferred from the reference (Rs, D2C, Meta);
flagged as an assumption to validate.

## 1. Vision
Help every performance team spend with confidence: know what to scale, stop, and shoot
next, before the money goes out. We turn a noisy ad account into one honest verdict and a
short list of moves, each one you can see the working behind. Values: **honesty** (no number
without its source and formula), **decisiveness** (a recommendation beats a report), and
**the human decides** (we never move money on our own).

## 2. Market segments (by problem / JTBD)
- **A. In-house D2C growth team (FIRST).** JTBD: "When I open my ad account, tell me what to
  do today without paying for a media buyer or a data analyst." Constraints: non-technical,
  time-poor, spend roughly Rs 3-30L/month (assumption). Acute weekly pain.
- **B. Performance agency (2-15 clients).** JTBD: "Give me a defensible, explainable weekly
  action list per client I can act on and show the client." Constraints: many accounts, needs
  trust + speed.
- **Why A first:** the reference is literally an in-house D2C cockpit; the pain is weekly and
  unmet; they will connect an account to get value; the feedback loop is fast; no analyst to
  displace, so we are additive, not threatening.

## 3. Relative cost position
**Premium value, low cost to deliver.** We are not the cheapest tool; we sell judgment, not
storage. But COGS is near-zero (Gemini + ScrapeCreators free tiers, Supabase/Vercel free),
so we can price well below a media buyer or analyst salary and still hold strong margins.
Position: high value, low COGS, mid-market price.

## 4. Value propositions
**Segment A (in-house D2C):**
- *What before:* stares at Ads Manager, guesses what to scale/kill, wastes spend on fatigued
  ads, no time to analyze.
- *How:* connect the account, get a one-sentence verdict + a ranked "do this today" queue,
  each with the working shown.
- *What after:* acts in minutes with confidence; recovers wasted spend; tests the right thing.
- *Alternatives today:* Ads Manager + gut feel; a freelance media buyer; spreadsheets; generic
  reporting dashboards.

**Segment B (agency):**
- *What before:* juggles many accounts, reporting eats the week, hard to justify moves to clients.
- *How:* one cockpit per client with explainable actions and a change history.
- *What after:* faster reviews, defensible recommendations, more accounts per buyer.
- *Alternatives today:* in-house dashboards, Triple Whale / Motion-style reporting, manual decks.

## 5. Trade-offs (what we will NOT do)
- **Not a reporting dashboard.** We decide, we do not just display. (No vanity-metric walls.)
- **Not an auto-optimizer.** We never move money without an explicit human yes (D12).
- **Not a creative-volume generator.** Concepts are grounded and few, not an AI slop firehose.
- **Not multi-channel-everything.** Meta first; Google second; TikTok/others later or never.
- **Not enterprise/big-brand-with-a-data-team** first. They already have analysts.
Saying no here is what lets the verdict stay short, honest, and trusted.

## 6. Key metrics
- **North Star:** weekly **approved actions applied per active account** (captures value
  delivered AND trust earned, not vanity logins).
- **OMTM (this quarter):** **activation** = % of connected accounts that reach a verdict and
  approve >=1 action within week 1. If they connect but never act, we have not earned trust.

## 7. Growth
- **Motion:** product-led for Segment A (connect -> see value in minutes, self-serve), founder-led
  sales for early Segment B agencies.
- **Channels:** founder's own LinkedIn audience (the sibling LinkedIn-growth project is a real
  distribution asset), Indian D2C/performance communities, agency partnerships, and public
  "teardown" content (a cockpit verdict on a well-known brand's ads).
- **Unit economics:** near-zero COGS on free tiers early; the cost line that matters is data
  (ScrapeCreators/paid ad data) and AI tokens at scale, both usage-scaling. Price anchored to
  "cheaper than a junior media buyer."

## 8. Capabilities needed
- **Build (core, the moat):** the deterministic rules engine (fatigue/waste/will-break/health),
  the knowledge-graph Brand Brain, the "show the working" explainer, and trust/safety (never
  auto-apply). These encode real media-buying judgment and compound.
- **Partner/buy (commodity):** competitor data (ScrapeCreators), AI reasoning (Gemini), auth/DB/
  hosting (Supabase/Vercel).
- **Develop:** Meta/Google API + OAuth reliability, prompt/eval discipline for Gemini, and a
  credible media-buying rule set (domain expertise is the scarce input, not code).

## 9. Can't / Won't (defensibility)
- **Compounding Brand Brain.** Each account's knowledge graph grows with use: what wins, what
  fatigues, what the algorithm did. That is a switching cost and a per-account data moat a new
  entrant cannot clone.
- **Trust via show-the-working.** Reporting tools show data; generators spit creative; neither
  *decides and justifies*. Our posture is hard to bolt on credibly.
- **Encoded judgment.** The rules engine is where real media-buying expertise lives; copying the
  UI is easy, copying correct calls is not.
- **Honest weak spots:** platform risk (we depend on Meta/Google API access and ad-data sources);
  reporting incumbents could add "recommendations"; defensibility is thin until the Brand Brain
  has months of data. Speed to trusted recommendations is the race.

---

## Coherence check
Vision (spend with confidence) → Segment A's JTBD (what do I do today) → premium-value/low-COGS
lets us undercut a media buyer → value prop is the verdict+queue → trade-offs keep it a decider
not a dashboard → North Star measures applied actions (trust) → PLG fits self-serve connect →
core capabilities (rules engine + Brand Brain) are exactly the moat in section 9. Elements
reinforce; the through-line is **trusted decisions, cheaply delivered.**

## Critical hypotheses (must be true)
- **H1 (trust to connect):** in-house D2C teams will OAuth-connect a real Meta account to a new tool.
- **H2 (correct + non-obvious calls):** longevity/impressions + the rules engine produce
  recommendations users judge right AND that they would not have easily caught themselves.
- **H3 (act, not just read):** users will approve/apply AI-surfaced actions, not merely browse.
- **H4 (trust without a human analyst):** "show the working" alone earns enough trust to act.
- **H5 (free-tier quality):** Gemini + ScrapeCreators free tiers are good enough on real accounts.

## Cheap validation experiments
- **Concierge cockpit (tests H2/H3/H4):** with read-only access to 3-5 real D2C accounts,
  hand-produce the verdict + do-this queue (no product), watch whether they act and would pay.
- **Rules backtest (tests H2):** run the rules on an account's history; check if past "will break"
  calls actually broke. Cheap, offline, high signal.
- **Connect fake-door (tests H1):** a landing page with a "Connect Meta" CTA; measure click-to-
  authorize intent before building the full flow.
- **Free-tier load probe (tests H5):** run one real account's ads through Gemini + ScrapeCreators
  free tiers; measure quality and whether rate limits bite.
Run the concierge + backtest first: they validate the core bet (correct, trusted, actioned
recommendations) with almost no build.
