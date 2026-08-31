# AdScale Autonomous Growth System — "runs without you" plan

_Goal: the agent does its work without you being there. Honest architecture: it splits into two zones. One can
run **fully autonomously, forever**. The other has **one irreducible human tap** — not because of caution, but
because removing it gets your accounts banned and your brand blacklisted (which ends the growth channel). This
plan maximizes the autonomous zone and makes the gated zone a ~1-minute-a-day tap, or removes it entirely by
staying on channels you own._

Working name for the agent: **Scout** (a listener/scout that finds and drafts, never spams). Rename freely.

---

## The two zones (the whole plan in one picture)

### 🟢 AUTONOMOUS ZONE — runs without you, ever (no ban risk, legitimate)
Everything up to and including publishing on **channels YOU own**:
1. **Discover** high-intent conversations (free sources).
2. **Research + qualify** (AI filters real intent from noise).
3. **Score + decide** (documented weights — already built + tested).
4. **Draft** the reply/post text (AI).
5. **Publish to OWNED channels** — your blog on adscaledigital.co, your LinkedIn page, your X — because posting
   *your own content on your own property* is legitimate and unlimited.
6. **Content engine** — turn recurring questions into blogs / guides / comparison pages / FAQs on your own
   site (SEO + AEO). This is the highest-ROI autonomous work and needs zero human touch.
7. **Measure + learn** (attribution, what works) and **repeat**.

**This zone alone is ~80% of the growth value, and it can be 100% hands-off.**

### 🔴 GATED ZONE — posting into OTHER people's communities (Reddit, Quora, HN, LinkedIn comments)
This is the ~20% that **cannot be safely unattended.** Not my rule — *reality*:
- Reddit / Quora / HN **prohibit automated posting** in their ToS. An unattended bot is banned in hours, and
  the domain (adscaledigital.co) gets blacklisted. **You lose the channel you were trying to win.**
- One spotted bot comment and the community brands "AdScale" a spammer — permanent, in the exact places your
  buyers hang out. For a product whose wedge is *credibility*, that's a 5-year wound.
- Your own spec forbids it (§core, §12, §13 require approval).

**The safe maximum here = policy-based, near-zero-touch:** you set the rules once ("only reply in these
communities, never promote, only score ≥ X"), Scout drafts, and you **batch-approve in ~1 min/day** — then it
posts through your real account. The tap is what keeps the account alive; it is a feature, not friction.

---

## What "fully without you" actually looks like (recommended build)

**Lead with the Autonomous Zone. It's where hands-off is both safe and highest-ROI:**

- **A self-writing content engine on adscaledigital.co.** Scout detects a recurring demand signal ("20 people
  asked why creative fatigue is faster"), writes a genuinely useful, sourced article/guide/comparison page,
  and **auto-publishes it to your own site** (commit → deploy). Fully autonomous. This is the compounding SEO
  + AEO moat — content worth citing that pulls buyers to you.
- **Owned-social auto-posting.** Scout repurposes each article into LinkedIn/X posts and **auto-posts to your
  own accounts** on a schedule. Legitimate, unlimited, hands-off.
- **The community layer stays draft + batch-approve** — a daily digest of ready-to-post replies you clear in a
  minute. Or skip it entirely and let the owned content + SEO do the work.

---

## What it takes (concrete — components, access, cost, effort)

| # | Component | Build effort | Access / key needed | Cost | Human touch |
|---|---|---|---|---|---|
| 1 | Discovery (HN live; + StackExchange, Google News RSS) | Small | none (free) | Free | None |
| 2 | Discovery (Reddit — best source) | Small | **Reddit app (free, 5 min, one-time)** | Free | One-time |
| 3 | AI intent-qualifier (kills false positives) | Small | Gemini (already set) | Free tier | None |
| 4 | AI draft generator (writes reply/post text) | Medium | Gemini (set) | Free tier | None |
| 5 | **Content engine → auto-publish to your own site** | **Medium-Large** | your site repo / CMS access | Free | **None** |
| 6 | Owned-social auto-post (LinkedIn page, X) | Medium | **LinkedIn app + page**; **X API (paid tier)** | LinkedIn free / X paid | None after setup |
| 7 | Community approval queue + daily digest | Medium | email or Slack webhook | Free | ~1 min/day |
| 8 | Attribution (UTM) + learning loop + owner dashboard | Medium | Supabase (set) | Free | None |
| 9 | Scheduling 24/7 | Done | GitHub Actions secret (1 min) | Free | One-time |

**Net:** almost everything is **free** and uses infrastructure you already have. The only real dependencies:
a **one-time Reddit app** (5 min), a **LinkedIn app + page** (if you want owned-LinkedIn auto-posting), and
**X's paid API** only if you want X. AI stays on the free Gemini tier.

## The honest tradeoff table

| You want… | Can it run with zero touch? | Risk |
|---|---|---|
| Discover + qualify + score + draft | ✅ Yes | None |
| Publish blogs/guides to **your own site** | ✅ Yes | None |
| Post to **your own** LinkedIn/X | ✅ Yes (after one-time app setup) | Low (quality only) |
| Reply in **Reddit/Quora/HN** communities | ❌ No — needs a human tap | **Account ban + brand blacklist if unattended** |
| Community replies with a **standing policy + batch approve** | ~1 min/day | Low, if rules are respected |

## Phased roadmap

- **Phase 1 (now, free, zero-touch):** finish discovery (Reddit app + StackExchange + RSS) + AI qualifier + AI
  draft generator + owner dashboard. Scout becomes a hands-off *listener + drafter*.
- **Phase 2 (the autonomous win):** the **content engine** — auto-writes + auto-publishes useful articles to
  adscaledigital.co (SEO/AEO). Fully hands-off, highest ROI. + owned-social auto-post.
- **Phase 3 (the gated layer, near-zero-touch):** community approval queue + daily digest + one-tap batch
  approve → posts via your account. Attribution + learning loop close the loop.

## The one thing I will not build

An unattended bot that posts into other people's communities on autopilot. It is the fastest way to get your
accounts banned and your brand branded a spammer — the exact opposite of growth — and your own spec forbids it.
Everything *around* that, including fully-autonomous publishing to channels you own, I will build.

---

## Recommendation

**Go hands-off where hands-off is safe and pays the most: the content engine on your own site.** Let Scout
discover demand and auto-publish genuinely useful content to adscaledigital.co + your owned social, 24/7,
zero touch. Keep the community layer as a 1-minute daily batch-approve (or drop it). You get ~90% of the
autonomy you're asking for, none of the ban risk, and a compounding SEO/AEO moat competitors can't buy.
