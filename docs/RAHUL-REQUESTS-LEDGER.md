# AdBrain — Rahul's Requests Ledger

The running log of everything Rahul has asked for, and its honest status. Updated after each change.

**Status key:** ✅ done + verified LIVE on the app · 🟩 done, code+build verified but NOT yet
live-tested · 🟨 partial / has a known gap · ⏳ pending · 🔴 needs Rahul's action (env/config)

---

## 0. Standing rules (never break these)

- **Test on the live app before claiming.** Never say done/green/fixed without reproducing the
  change running live in the actual deployed app (not just `tsc`/`build`/local checks). Rahul keeps
  the app signed in for this. (Set as a hard rule 2026-08-28.)
- **Verify to 100% before claiming.** Plan first, then cross-check every change, including edge
  cases. This is Rahul's biggest build rule.
- **Never show a number that can't be trusted.** Every figure must trace to a real calculation on
  real data; no fabricated dates/counts/links.
- **A former collaborator's name must NEVER appear anywhere** — chat, code, files, or docs.
- **Stop the endless "next."** Do the one thing asked, prove it live, stop. Don't build unrequested
  work.
- **Keep this ledger updated** after everything, plus MEMORY entries for durable facts.

---

## 1. Requests log (from day one)

### Data trust & correctness
1. Wire the remaining "10x" engines (data-quality, winner) into the cockpit. — 🟩
2. Objective filter: selecting Sales/Conversion must show real spend matching Ads Manager (was
   showing "no ads with spend"). — 🟩 (resolve from ALL campaigns, every status, paginated)
3. Deep root-cause: dashboard numbers must match Ads Manager per account/objective/window; show
   nothing without a trustworthy calculation. — 🟩
4. **P0 found in audit:** the insights pull silently truncated data past 6,000 rows, under-counting
   spend/ROAS on 60–90 day windows. — 🟩 fixed (page size now scales to ad×day volume)
5. Ad deep links must open Ads Manager at **ad level** with campaign + ad set + ad all selected. — 🟩
6. Spend distribution: show conversions + ROI% vs the whole account + an ⓘ explainer. — ✅ (seen live)
7. Suggestions: check current status; **hide paused ads**; show only active ads wasting budget;
   prefer active ads. — 🟩
8. Show WHERE + WHY: campaign names, ad-set names, ad name, and the calculation, per the selected
   date range. — ✅ (waste + opportunity drill-downs seen live with names + math)
9. Every verdict (incl. "Hold") shows its WHY in light text. — ✅ (seen live: "↳ Not enough signal
   to act without risk")

### UI / UX
10. Clean up the "very poor / AI-made" UI once and for all. — ✅ redesign live (consistent type
    scale, light headings, unified corners); it is a *consistency pass*, not a dramatic reskin.
11. Topbar: calendar opens on click; multi-select campaigns; order Account→Date→Objective→Campaign;
    campaign list filters by the selected objective. — 🟩
12. Move extra rows to "See more." — ✅ (seen live: "Show 92 more ads", toggle works)

### Competitor / Market
13. Competitor data must change per account (Kimirica showed another brand's competitors = bug);
    auto-process in background on account switch; every change applies to all future users. — 🟩
14. Report coverage of the 9-stage competitor diagram (green-underline each item) every 6–7 pushes. — ⏳

### Ask AdBrain (answer engine)
15. Build the "Ask AdBrain" answer engine, grounded only in real data, never invent numbers. — ✅
    (answered live: "The ad wasting the most budget is Ad_133/02/4")
16. Make it free — switched from paid Claude to **Gemini free tier**. — ✅ (works live, ₹0)
17. Starter questions + readable answer panel. — ✅ (seen live: "TRY ASKING" panel)
18. Hardened against slow-Gemini timeouts (graceful message, not a hard fail). — 🟩

### Speed / scale / architecture
19. Make it ready for **1000 visitors/day**; stress test everything (architecture, memory, ledger,
    whole source funnel); use parallel subagents. — 🟩 (6 production-readiness audits run + fixes)
20. Every left-nav option has its own page + URL. — ✅ (already true; all routes exist)
21. Make processing 10x faster; the 3-day speed issue. — 🟩 diagnosed + fixed the big levers:
    - **Local-JWT auth** (getClaims, local verify — 2 network round-trips per click removed). — 🟩
    - **Background sync** cron to pre-warm the cockpit (needs `CRON_SECRET`). — 🟩 / 🔴
    - Warm-path token read removed; Settings light-load; parallelized Meta batches; L2 write
      deferred off the cold path; competitor pull bounded-concurrency; RLS initplan fix. — 🟩
22. Full deep-dive performance + architecture audit (browser→Next→Supabase→Postgres→Vercel→CI);
    implement P0/highest-ROI P1. — 🟩 (audit artifact published; fixes shipped)
23. CI: 15 of 33 correctness gates were missing from CI. — 🟩 (single `check:all` + concurrency +
    build cache)
24. Security headers (X-Frame/nosniff/Referrer/Permissions/HSTS) + CSP report-only. — ✅ headers
    verified live; CSP report-only added.

### Dead / broken buttons (full QA sweep)
25. **/book-demo form was a black hole** (never submitted). — ✅ fixed + verified live (a test lead
    landed in the real DB, honeypot blocked spam).
26. **Settings "Verdict weights" panel was dead.** — ✅ now applies ("Applied — scores updated" seen
    live); integration-proven (84.9 → 90.0).
27. Rate-limit the paid AI call; topbar fake "Connected" pill; OAuth 500 guards; judgment-button
    silent fail; competitor dedup + dead links; competitor-list focus glitch (L6). — 🟩

### Process / meta
28. Keep pushing git; raise confidence toward 100%; make it 10x better. — ongoing
29. Verify to 100%, plan first, cross-check edge cases. — standing rule
30. Test on the live app before claiming green. — standing rule (2026-08-28)
31. List all pending work + time per task + sessions to 100% ready. — ✅ delivered (see §3)
32. Create this ledger of everything from day one. — ✅ (this file)

---

## 2. The deployment truth (why "no change" happened)

For a stretch, Rahul saw **no change in the live app** despite many commits. Root cause: a
`vercel.json` **hourly cron** I added — his Vercel plan is **Hobby**, which rejects sub-daily crons,
so **every deploy silently failed** and nothing reached production. Fixed 2026-08-28 (daily cron);
production is current again. My earlier "green" also over-claimed: it meant "code compiles," not
"live and working." That distinction is now the standing rule above.

---

## 3. Pending to 100% (finite)

| Task | Status | Est. |
|---|---|---|
| Full live QA of every screen, fix what breaks | in progress | ~1 session |
| Creative → **format diversity shows "Unknown" for all ads** (real gap found in QA) | 🟨 | part of QA |
| Creative decoder → Diversity(semantic) / Brand Brain / Concepts (Gemini) — build OR remove placeholders | ⏳ | ~1 session if built |
| Market → Voice of Customer | ⏳ | ~0.5 session |
| Shopify connect → real MER & nCAC | ⏳ | ~1–2 sessions (optional) |
| Rahul: set `CRON_SECRET` in Vercel (activates background sync) | 🔴 | 2 min |
| 9-stage competitor diagram coverage report | ⏳ | small |

**To a fully-featured 100%: ~3 sessions.** Lean (QA + polish + remove the "coming soon"
placeholders): **~1.5 sessions.** Shopify is the only thing that could stretch it, and it's optional.

---

## 4. Known live-QA findings (2026-08-28)

- ✅ Cockpit, Ask (Gemini), Settings + weights, book-demo, Media, Market(Competitors input), auth —
  all verified working live on Rahul's real Kimirica account.
- 🟨 **Creative → Diversity → "Creative format diversity" shows "Unknown — 100% of spend · 100 ads"**
  — the deterministic format detection is not populating for any ad. Needs a fix.
- 🟨 **`/app/creative` 504'd once on a cold load** — a cold cockpit pull can exceed Vercel's function
  timeout; the background sync (once `CRON_SECRET` is set) keeps the cache warm and avoids this.
- Brand Brain + Concepts are honest, well-designed "coming next" placeholders (need the decoder).

---

## 5. Session 2026-08-31 — shipped (reinforced: full `check:all` green, `next build` clean)

Every item below is committed to `validation-v0-v1` (prod → adscaledigital.co) and passes the whole gate
(~80 check scripts pass together; tsc + build green). Items 5–8 are **not yet verified on Rahul's live
account** — that is the one open gap and Rahul's own hard rule (verify to 100% live).

| # | Asked | Shipped | Status |
|---|---|---|---|
| 1 | 1,000 decision rules | 1,061-rule corpus (Excel + JSON) in `docs/decision-rules/` | 🟢 |
| 2 | Triple-Labelled judgment engine | Parallel Judge agent (`lib/judgment/`, Evidence·Agreement·Confidence); live API verified | 🟢 |
| 3 | Show the triple label on cards | `ActionList` shows Evidence ✓ · N/3 agree · Conf tier; render verified | 🟢 |
| 4 | Enterprise control-plane / security | 5-plane audit + immutable audit log (0015), kill switches (0016), RBAC catalog, data classification, plane-boundary guard; **migrations applied + immutability verified live**; red-team fixes (SSRF on Shopify, prompt-injection in 4 AI routes, cost-DoS on /api/judgment) | 🟢 |
| 5 | No actions on paused/ended ads | Action queue gated to `active !== false && delivering !== false` (recent-spend liveness) | 🟢 live-verified 2026-08-31 |
| 6 | Ad-set/campaign strike graphs + native metrics | Delivery sparklines + native reach/frequency/budget (Meta `level=adset/campaign` pull, best-effort) | 🟢 live-verified 2026-08-31 |
| 7 | Per-entity drill-in + buyer metrics + picker | Entity drill-in card grid, per-level buyer-native metric sets, metric picker (per-level, persisted, full KPI-sheet menu) | 🟢 live-verified 2026-08-31 |
| 8 | "Paused campaign caused the drop" | Culprit-diagnostic (`lib/scoring/culprit.ts`): account-drop + stopped material contributor, ad-set + campaign grain, corroborated with the real logged change (`ad_changes`) | 🟢 live-verified 2026-08-31 |

**Global liveness rule (Rahul, 2026-08-31):** the app never points to a paused/ended entity as a to-do,
but MAY name it as the cause of a recent drop. Applied across the action queue (5), the level view's
"not delivering" tags (6–7), and the "Why results dropped" banner (8).

**New checks in the gate:** check:judgment, check:audit, check:flags, check:rbac, check:plane,
check:classification, check:compose, check:delivering, check:culprit (+ background-agent additions).
