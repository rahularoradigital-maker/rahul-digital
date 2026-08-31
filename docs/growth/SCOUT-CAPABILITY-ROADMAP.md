# Scout — Capability Roadmap (closing the 5 gaps)

_How we make Scout do everything on the "can't do today" list — split by who's needed. Most of it I can build
autonomously (no input from you); a few need one-time free setup; one I will not build (and why)._

Legend: 🟢 I build it now, hands-off · 🟡 needs a one-time thing from you · 🔴 won't build (harmful)

---

## Gap 1 — "Post anything"

- 🔴 **Unattended posting into others' communities (Reddit/Quora/HN):** won't build. Automated posting is
  against their ToS → account ban + adscaledigital.co blacklisted within hours → you lose the channel and the
  brand gets tagged a spammer. Your own spec (§core/§12/§13) forbids it.
- 🟢 **The safe version — a one-tap approve queue.** Scout drafts the reply; the dashboard shows a **"Copy
  reply & open thread"** button. You glance, tap, paste, post — ~5 seconds per item, your account stays alive.
  I build this now. *(Real API posting to a community is only added later, per-platform, where it's allowed.)*
- 🟢 **Auto-post to channels YOU own** (your blog — see Gap 3; later your LinkedIn/X with their APIs) — fully
  hands-off, because posting your own content on your own property is legitimate.

## Gap 2 — "Discover beyond Hacker News"

- 🟢 **StackExchange** (webmasters/marketing) — free, no key, works from a server. **Build now.**
- 🟢 **Google News RSS** — free, no key, for trend detection (§28). **Build now.**
- 🟡 **Reddit** — the richest source. Needs a **one-time free app** (reddit.com/prefs/apps → "script",
  ~5 min). Code is already wired; it activates the moment `REDDIT_CLIENT_ID`/`SECRET` are set.
- 🟡 **YouTube** (creator/expert monitoring, §25) — free API, needs a **free key** (one-time).
- 🟡/💲 **LinkedIn / X / Quora** — gated or paid APIs; add when you want them (LinkedIn app; X paid tier;
  Quora via a paid provider).

## Gap 3 — "Publish content to your own site"

**Key realization: adscaledigital.co IS this app.** So no external host needed — I build a **DB-backed blog**
inside it:
- 🟢 **Content engine:** on a demand signal ("20 people ask why creative fatigue is faster"), Scout **writes a
  genuinely useful, sourced article** (with the §18 quality gate: factual/originality/policy checks), stores
  it, and it renders at **adscaledigital.co/blog/<slug>** — the SEO + AEO moat. **Build now.**
- Safety: articles are AI-written, so they land in Scout's dashboard as **draft articles with one-tap
  publish** (a wrong public article hurts the brand — a 5-second human "publish" tap is the guardrail). Fully
  autonomous authoring; one tap to go live. *(Can be flipped to full auto-publish once you trust the quality.)*

## Gap 4 — "One-tap approve → post queue"

- 🟢 **Build now.** An owner-gated queue: each drafted reply/article with **Approve / Dismiss**, a **Copy &
  open** button, and status tracked (approved/dismissed/posted) in an **audited** table. Approving a reply
  gives you the text + the thread link in one tap; approving an article publishes it. Nothing auto-posts to a
  community; the human tap is the safety valve.

## Gap 5 — "Attribution / learning loop"

- 🟢 **Build now (foundation):** every link Scout drafts gets a **UTM tag** (source/community/topic/content-id),
  and a **topic-performance memory** records which topics/communities produced drafts + (later) traffic. §21/§22.
- 🟡 **Full loop** (signup → paid tied to source) needs **live traffic + the signup event wired to UTMs** —
  real once the content is published and people arrive. The plumbing I build now; the numbers fill in as
  traffic flows.

---

## Build order (what I'll do autonomously, in sequence)

1. **More sources** (StackExchange + Google News RSS) — quick, free. _[starting now]_
2. **Approve → post/publish queue** (Gap 4) + the "copy & open" reply flow (safe Gap 1).
3. **Content engine + /blog** (Gap 3) — the biggest hands-off win.
4. **Attribution foundation** (UTM + topic memory, Gap 5).
5. **AI intent-qualifier** (deeper false-positive kill) as sources widen.

## What I need from you (one-time, whenever — none blocks the above)

- **Reddit free app** (5 min) → unlocks the best source.
- Later, only if you want them: **YouTube key** (free), **LinkedIn app + page**, **X paid API**.
- A yes/no on **full auto-publish vs one-tap publish** for blog articles (default: one-tap, safest).

## What I will not build

Unattended posting into other people's communities. It ends the growth channel it's meant to build. Everything
else on your list, I'm building.
