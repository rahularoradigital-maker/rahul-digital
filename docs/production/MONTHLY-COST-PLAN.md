# AdBrain — Monthly Cost Plan (at your real scale)

> Scale assumed: ~100–150 website visitors/day, **5–15 actual app users/day (max)**. This is a *tiny* load —
> so most services' FREE tiers are genuinely enough. Only a couple of paid plans are worth it, and only for
> **reliability + not losing data**, not for capacity. Prices are provider list prices (2026); usage numbers
> are honest estimates, marked as such.

## The verdict in one line
**~$45/month fixed (Vercel Pro + Supabase Pro) + ~$10–30/month Gemini usage = roughly $55–75/month all-in.**
Everything else runs on free tiers at your scale.

---

## Service-by-service

| Service | What it does | Your scale vs free tier | Verdict | Monthly cost |
|---|---|---|---|---|
| **Vercel** | Runs the website + app | Free "Hobby" kills any request >60s → a **big account's first/cold load can time out (504)**; also Hobby forbids commercial use | **PAY — Pro** (lifts 60s→300s, legal for business) | **$20** |
| **Supabase** | Database + logins + file storage | Free tier fits your data easily, BUT free has **no real backups** → one bad delete/corruption loses user data | **PAY — Pro** (daily backups, no auto-pause, headroom) | **$25** |
| **Google Gemini** | The AI brain (analysis, ranking, images) | Usage-based; ~5–15 users doing occasional analysis | **PAY — usage** (you already have billing on) | **~$10–30 (est.)** |
| **Meta Marketing API** | Your ad data, change history, Ad Library | Free — it's your own account's data | Free | **$0** |
| **Resend** (email) | Password-reset + verification emails | Free = 3,000/mo, 100/day. You send a handful/day | **Free tier is plenty** | **$0** |
| **Upstash** (Redis) | Distributed rate-limit + AI cost counter | Free = 10k commands/day; you'd use a trickle | **Free tier is plenty** (or skip) | **$0** |
| **Sentry** (error alerts) | Tells you when something breaks | Free = 5k errors/mo, 1 project | **Free tier is plenty** | **$0** |
| **OpenAI + Anthropic** | *Fallback* AI (only if Gemini fails) | Rarely hit at your scale | Usage, near-zero | **~$0–5** |
| **ScrapeCreators** | Richer competitor-ad data | The app already **falls back to the free Meta Ad Library** for competitor data | **SKIP** (use the free source) | **$0** |
| **Domain (GoDaddy)** | adscaledigital.co | Already owned | Already paid | **~$1.5** (amortized) |

---

## Two ways to think about it

### A. "Nothing breaks, data is safe" (recommended)
| Item | Cost |
|---|---|
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Gemini usage (est.) | $10–30 |
| Everything else (Resend, Upstash, Sentry, Meta, fallbacks) | $0 |
| **Total** | **~$55–75 / month** |

### B. "Absolute minimum, accept risk"
Stay on free Vercel + Supabase, pay only Gemini usage → **~$10–30/month**.
**The risks you accept:** a large account's first load can time out; **no database backups (data-loss risk)**; and you're running a business on a hobby plan (against Vercel's terms). Fine for a few more weeks of solo testing; **not fine once real users' data is in there.**

---

## Why the two paid ones are the ones that matter (honest)
- **Supabase Pro ($25) — the one I'd insist on.** It's not about traffic; it's **backups**. At 5–15 real users, their connected accounts + analysis are precious. Free tier can't restore if something goes wrong. $25 buys daily backups.
- **Vercel Pro ($20).** The free 60-second cutoff is a real risk for a *big* account (like boAt, ~294 ads) on a cold load — it can 504. Pro removes that. Plus it's the legal plan for a paid product.
- **Gemini** you already pay per use; at this scale it's small.

## What you do NOT need to pay for (at this scale)
Email (Resend free), rate-limiting/cost-counter (Upstash free), error alerts (Sentry free), Meta data (free), competitor data (free Meta Ad Library), OpenAI/Anthropic (fallbacks, near-zero). **Don't buy ScrapeCreators** — the free source covers it.

## Not-monthly, one-offs to keep in mind
- Nothing required. (Custom domain already owned. No Stripe/payments in the product yet, so no payment-processor fees.)
