# AdScale Growth Agent — Tool & Source Registry

_What the agent uses, whether it's free, whether it needs anything from you, and what actually works today
(verified 2026-08-30). The rule: prefer free + zero-touch; be honest when a source needs a one-time setup._

## Discovery sources (spec §4)

| Source | Cost | Works today, zero-touch? | Notes / what it needs |
|---|---|---|---|
| **Hacker News** (Algolia API) | **Free, no key** | ✅ **Yes — wired + running** | Public search API, works from a server. On-topic DTC/media-buyer threads. This is the live source now. |
| **StackExchange** (webmasters/marketing) | Free, no key | ✅ Yes (low volume) | Public API; niche but real. Easy to add next. |
| **Reddit** (r/PPC, r/FacebookAds, …) | Free API, but **needs a free app** | ⚠️ **No — 403s unauthenticated** | Reddit blocked server-side public JSON in 2023. Needs a one-time **free Reddit app** (client_id/secret) → then read-only forever. **~5 min from you, once.** Highest-value source. |
| **Quora** | No official API | ❌ Not compliant free | Needs a paid provider (Apify/ScrapeCreators) or is disallowed. Skip unless you want to pay. |
| **LinkedIn / X** | Restricted / paid | ❌ | Official APIs are gated/paid; scraping violates ToS. Paid providers only. |
| **YouTube** | Free API, needs a **free key** | ⚠️ One-time free key | YouTube Data API v3 free tier. ~5 min from you, once. Good for creator/expert monitoring (§25). |
| **Google News / RSS** | Free | ✅ Mostly | RSS feeds, no key. Add for trend detection (§28). |
| **Apify / ScrapeCreators** | **Paid (credits)** | ❌ needs credits | Compliant multi-platform scraping (Reddit/Quora/etc.) — the paid path if you want Reddit/Quora without app setup. ScrapeCreators is currently out of credits. |

## AI / reasoning (spec §10, §17, §18)

| Tool | Cost | Status |
|---|---|---|
| **Gemini** (flash-lite) | Free tier | ✅ Already in the app (your key). Used for drafting + intent qualification. |
| Claude / OpenAI | Paid | Optional, for higher-quality drafts. Not required. |

## Storage / scheduling / attribution

| Need | Tool | Cost | Status |
|---|---|---|---|
| Store conversations, topics, communities, briefs | **Supabase** (already yours) | Free tier | Ready — needs the growth tables added (next phase). |
| 24/7 schedule | **Vercel Cron** (already yours) or a local cron | Free | See "Enabling 24/7" below. |
| Attribution (§22) | UTM links + the app's own analytics | Free | UTM tagging on any link the agent drafts; wire to signups later. |

## What's genuinely free + zero-touch RIGHT NOW

- **Hacker News discovery** → score → decide → **daily brief** (drafts only). Running and verified.
- No key, no account, no approval, no cost. It writes a report for you to read; it publishes nothing.

## What needs a ONE-TIME, free, ~5-minute setup from you (then zero-touch forever)

1. **Reddit app** (the big one) — the richest source of DTC/media-buyer conversations.
   - reddit.com/prefs/apps → "create app" → type **script** → note the **client_id** + **secret**.
   - Give me those (or set `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`) → Reddit joins automatically.
2. **YouTube Data API key** (optional) — for creator/expert + trend monitoring.

## What needs PAID credits (only if you want them)

- Apify or ScrapeCreators — for Reddit/Quora/LinkedIn without any setup, at a cost per pull.

## The hard boundary (spec §core, §12, §34 — non-negotiable)

The agent **never auto-publishes** anywhere. It discovers → scores → decides → **drafts into a queue**. Every
external reply or post is a **human approval**. "Free + no-touch" covers everything up to the draft; publishing
is always yours. This is the difference between a growth-intelligence system and a spam bot.
