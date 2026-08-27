# AdBrain - Project Ledger (living master)

The single place to review everything about this app: every request Rahul makes, every
cookie/storage key, every formula and logic, and each shared document mapped to what was
built. Updated as work happens. Lives in the repo (version-controlled) and is the file to
mirror to Google Drive for review.

- **Repo:** `~/adbrain-mvp` · **Live:** https://rahul-digital.vercel.app
- **Biggest rule:** no number is ever shown that is not derived from a stated rule/formula.
- **Absolute rule:** the former collaborator's name never appears anywhere in this project.
- **Last updated:** 2026-08-27

---

## 1. Feedback & queries log
Every request/feedback, newest at the bottom. Status: 🟢 done · 🟠 partial/unverified · 🔴 not started.

| # | Request | Status |
|---|---------|--------|
| 1 | Rebuild `/app` dashboard to match the shared HTML design | 🟢 |
| 2 | Real Meta ads flowing from the connected account | 🟢 |
| 3 | Speed is slow, remove bloat (every dashboard slow) | 🟢 (9s -> ~600ms via loading.tsx + L2 cache + SWR) |
| 4 | Whole left menu working; consolidate to 6 items | 🟢 |
| 5 | Everything must come from real account data, no sample data | 🟢 |
| 6 | Select BM -> Account -> Campaign -> date range -> objective | 🟢 (custom date range 🔴) |
| 7 | KPIs: option to select all (162-KPI set) | 🟢 |
| 8 | Account switch shows the same score for every account | 🟢 (cache now keyed by active account) |
| 9 | Remember login email next time | 🟢 |
| 10 | Build the 9-stage competitor intelligence system (diagram) | 🟢 (stages 1-9 live) |
| 11 | Reduce human effort; auto-suggest competitors by market | 🟢 (brand search + click-to-add) |
| 12 | Every ad links to that ad in Ads Manager to cross-check | 🟢 |
| 13 | Account Health must be dynamic per account, never a flat 50 | 🟢 (absolute, objective-aware) |
| 14 | Show the full reason WHY 21/100 (nothing assumed) | 🟠 (rubric + WhyDrawer built; wiring to Health pending) |
| 15 | Scoring rubrics for every number; nothing without a rule | 🟠 (registry built; extending to every number) |
| 16 | Day-wise fatigue (real, per 7/14/30d), not a proxy | 🟢 |
| 17 | Creative half-life score (account + per-ad) | 🟢 |
| 18 | Multiple small agents + orchestration layer (no single agent) | 🟢 (stage-7 orchestrator) |
| 19 | Show campaigns / ad-sets / ads processed each run | 🟢 (cockpit context line: N campaigns, M ad sets, K ads) |
| 20 | Can a static ad image be read? | 🟢 (yes - verified: Gemini describes the image) |
| 21 | Ad Library link button per brand; show ads as in FB Ad Library | 🟢 |
| 22 | Incorporate Imagive.ai data/logics/items | 🟠 (spec in docs/imagive-spec.md; building) |
| 23 | Build on labeled triples; RLEF as the audit baseline | 🟢 (decision_triples table + per-run logging live) |
| 24 | Searchable campaign + objective dropdowns; custom date range | 🟠 (search 🟢; custom date range 🔴) |
| 25 | This living ledger + mirror shared docs to Google Drive | 🟢 (ledger built; Drive mirror offered) |

---

## 2. Cookies & client storage
Everything the app writes to the browser. There are no third-party/tracking cookies.

| Key | Type | Set by | Read by | Purpose |
|-----|------|--------|---------|---------|
| `adbrain.campaign` | cookie (30d) | `components/app/campaign-switcher.tsx` | `lib/app/cockpit-data.ts` (server) | Active campaign filter; empty = all |
| `adbrain.objectives` | cookie (30d) | `components/app/objective-switcher.tsx` | `lib/app/cockpit-data.ts` (server) | Selected objective filter (comma list); empty = all |
| `adbrain.lastEmail` | localStorage | `components/auth-form.tsx` | same | Prefill the login email next visit |
| `adbrain.competitors` | localStorage | `components/app/market/competitor-input.tsx` | same | Remembered brand + competitor Ad Library URLs |
| Supabase auth session | cookie | `@supabase/ssr` | server + client | Login session (managed by Supabase) |

Server-side state (not browser): `cockpit_cache`, `competitor_ads`, `competitor_brands`,
`competitor_creative_analysis`, `ad_accounts`, `oauth_tokens` (Supabase, user-scoped, RLS).

---

## 3. Formulas & logics
Every score is deterministic and defined in the rubric registry `lib/scoring/rubrics.ts`.
Each has a runnable check under `scripts/check-*.ts` (the proof it does what it says).

| Score / logic | Formula (plain) | Code | Check |
|---|---|---|---|
| **Account Health** | Spend-weighted average of each ad's absolute objective score, minus 25 x wasted-spend share | `lib/cockpit/analyze.ts` | check:cockpit |
| **Objective score** (absolute) | ROAS-vs-benchmark (conversion), CTR-vs-benchmark (traffic/engagement/leads/installs), reach+freshness (awareness). ROAS 1x~39/2x~63/4x~86; CTR 1%~49/2%~74/4%~93 | `lib/scoring.ts` | check:scoring |
| **CreativeScore** | 0.30 performance + 0.30 trend + 0.20 (100-fatigue) + 0.20 funnel | `lib/rules/verdict.ts` | check:verdict |
| **Verdict** (conversion) | Winner needs ALL gates; loser only after the causality ladder rules out non-creative causes; else hold | `lib/rules/verdict.ts` | check:verdict |
| **Decision** (non-conversion) | Objective score + day-wise fatigue -> Scale/Continue/Refresh/Pause/Hold; confidence scales with days | `lib/scoring/decision.ts` | check:decision-engine |
| **Fatigue (day-wise)** | 0.4 frequency saturation + 0.4 CTR decay slope + 0.2 CPM rise slope over the window | `lib/scoring/fatigue.ts` | check:fatigue-daywise |
| **Creative half-life** | Days to when CTR falls to 60% of its window start (extrapolated from the CTR decline) | `lib/scoring/fatigue.ts` | check:fatigue-daywise |
| **Performance** (percentile) | Rank within the account's SAME-objective ads on that objective's metric | `lib/scoring.ts` | check:scoring |
| **Funnel health** | Conversion: avg(CTR pct, CVR pct); non-conversion: CTR pct only | `lib/scoring.ts` | check:scoring |
| **Wasted spend** | Spend on conversion ads with ROAS < 1 (other objectives never counted as waste) | `lib/scoring.ts` | check:scoring |
| **Concentration** | Top ad spend / total spend | `lib/rules/account.ts` | check:account |
| **Funnel metrics** | thumb-stop, hold rate, CTR/CPM/CPC, LP/ATC/checkout ratios; null on any 0 denominator | `lib/metrics/funnel-metrics.ts` | check:funnel-metrics |
| **Competitor analytics** | Counts over real Ad Library ads: format/CTA/hook mix, whitespace gaps | `lib/competitors/analytics.ts` | check:competitors |
| **Creative analysis (LLM)** | Multi-agent Gemini: hook/message/offer/visual/creator specialists -> funnel classifier | `lib/agents/creative/*` | (live-verified) |

---

## 4. Documents shared -> what was built
Each real document Rahul shared, mirrored into `docs/`, and what it changed in the app.

| Document | In repo | What it drove |
|---|---|---|
| LinkedIn/tech rulebooks (sanitized) | `docs/rules/` | Voice, verdict/scoring rules, quality gates |
| 9-stage competitor diagram | `docs/competitor-intelligence.md` | The whole competitor pipeline (stages 1-9), stage->code map |
| Imagive.ai competitive tool | `docs/imagive-spec.md` | Roadmap: ad-traffic distribution, longevity top ads, dedupe, placement insight |
| AI vocab / audit doc (sanitized) | `docs/ai-audit-architecture.md` | Labeled-triples + RLEF audit design; decision_triples plan |
| KPI set (162 KPIs) | `lib/app/kpi-catalog.ts` | The KPI catalog + select-all |

---

## 5. Change log (dated)
- **2026-08-27 (batch 6, 10x master brief)** System AUDIT + missing-intelligence report + metric
  dictionary + time-window mapping + roadmap (docs/10x-audit-and-plan.md). Four new pure, tested
  engines built in parallel: MARGINAL SCALING (elasticity -> Underfunded/Healthy/Saturated +
  marginal ROAS, MODELLED), DATA-QUALITY (small-sample/spend-shock/gap -> confidence penalty),
  FATIGUE FORECAST (7/14-day probability, PREDICTED), CREATIVE WINNER (quality x scale x
  stability x longevity). Wired into the cockpit: Scaling-headroom card + per-ad 7/14-day fatigue
  risk on the radar. Every value labeled OFFICIAL/INTERNAL/MODELLED/PREDICTED. All 22 checks green.
- **2026-08-27 (batch 5, autonomous)** Fatigue is now OBJECTIVE-AWARE (conversion fatigues on
  falling ROAS / rising CPA + CPM, awareness on reach, engagement/traffic on CTR) and the
  half-life is CAPPED by the ad set / campaign END DATE (a creative cannot outlive its ad set).
  Searchable ACCOUNT selector (200+ accounts). Discovery gets a name-relevance boost so the
  exact brand (boAt) outranks big unrelated pages (Boateng). Ad Performance Intelligence summary
  on the competitor dashboard (live ads / active / creative mix / new-7d, real counts only).
  Verified data flow live: real ad_ids + objectives flowing (via the decision_triples audit).
  NOTE: the "Ad Performance Intelligence" screenshot Rahul shared is the Imagive.ai reference
  tool; our equivalent is Market -> Competitors (now with the summary row + platform/traffic/
  longevity). Device-level breakdown data is a NEXT data pull. All checks green.
- **2026-08-27 (batch 4, autonomous)** Competitor discovery re-ranked (verified + most-liked
  brand page first, with badges) so the RIGHT Meta page is picked; funnel metrics wired to the
  cockpit (thumb-stop, hold, CTR/CPM/CPC, LP/ATC/checkout from real actions); Meta pull now
  PAGINATES and analyzes the top 100 ads (was 25); campaigns/ad-sets/ads processed shown;
  decision_triples table + deferred per-run logging (RLEF spine); competitor platform
  distribution; new cookie none. New tables: decision_triples. All 18 checks green.
- **2026-08-27 (batch 3)** Mobile nav drawer (sidebar was hidden on phones); ad links filter to
  the exact ad + carry the AdBrain date window; Meta data expansion started - the insights pull
  now captures campaign_id/adset_id, and the cockpit shows how many campaigns / ad sets / ads a
  run processed; orchestration plan (MetricsSource connector interface, not LangGraph). Ledger
  mirrored to Google Drive.
- **2026-08-27 (batch 2)** WhyDrawer wired onto Account Health (live "why 21/100?" per-ad
  breakdown); custom date range (presets + from/to via the `adbrain.window` cookie);
  searchable campaign + objective dropdowns; Ad Library links + FB-style creative gallery
  (Ad Library links verified live); Ad Traffic Distribution (own-site vs Amazon/Flipkart/app);
  opportunity-loss card (wasted + at-risk spend in rupees); decision_triples audit module +
  funnel-metrics engine (built, tested); RLEF audit architecture doc; new cookie
  `adbrain.window`. Delivered via 9 parallel subagents across two waves. All 22 checks green.
- **2026-08-27** Account-switch cache fix; email remember; objective-aware Account Health (no
  more flat 50); every ad -> Ads Manager link; competitor pipeline stages 1-9 live on real
  data; multi-agent Gemini stage 7 (verified reading static images); day-wise fatigue engine
  + creative half-life; objective-aware decision engine wired (fixes flat Hold/35%); topbar
  searchable campaign/objective; Ad Library links + FB-style creative gallery; funnel-metrics
  + WhyDrawer modules; RLEF audit architecture; this ledger.

> To update: append the request to section 1, add any new cookie/formula/doc to sections
> 2-4, and add a dated line to section 5. Keep it honest (partial = 🟠, not started = 🔴).
