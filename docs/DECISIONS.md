# AdBrain Decision Log

Settled decisions, so we stop re-litigating them. If you want to reopen one, change
its status and say why. All dates 2026-08-25. Decider: Rahul (owner); architecture
decisions co-owned with Claude (implementer). Governing docs linked per entry.

---

### D1 — Build the full product, but phased (not all at once)
- **Decision:** Build the deepsolv-style SaaS as a real MVP, in sequenced phases, not one big bang.
- **Context:** "Build this from zero" for a full SaaS, non-technical owner, goal = MVP for first users.
- **Options:** all-at-once full platform; clickable prototype; phased MVP.
- **Rationale:** phasing is the only way a solo non-technical owner ships something usable instead of nothing for months.
- **Status:** Active. **Revisit-by:** if a co-founder/team joins (parallelism changes the math).
- Governs: `docs/superpowers/specs/*`.

### D2 — Managed, low-ops stack
- **Decision:** Next.js + Supabase (auth/DB) + Vercel + an AI API. No self-hosted infra.
- **Context:** Non-technical owner; Claude runs all code.
- **Options:** custom backend/infra; various hosts/DBs.
- **Rationale:** nothing to patch or babysit; generous free tiers; one codebase.
- **Status:** Active. **Revisit-by:** if scale/compliance outgrows managed tiers.

### D3 — Brand Brain = knowledge-graph triples in Postgres
- **Decision:** Store learned facts as subject-predicate-object triples in a Postgres `triples` table. No separate graph DB.
- **Context:** Owner asked for a knowledge-graph "Brand Brain."
- **Options:** loose text notes; a dedicated graph DB (Neo4j); Postgres triples table.
- **Rationale:** queryable and auditable without new infra; Neo4j is overkill at MVP scale.
- **Status:** Active. **Revisit-by:** if graph traversal outgrows SQL.

### D4 — Ship under "AdBrain," not deepsolv
- **Decision:** Own brand/name; never deepsolv's identity.
- **Context:** Replicating deepsolv's product for real users.
- **Options:** clone deepsolv branding; use our own.
- **Rationale:** cloning a real company's brand is trademark infringement / impersonation.
- **Status:** Active (name is a placeholder). **Revisit-by:** when a final brand name is chosen.

### D5 — Data source: ScrapeCreators (replaced Apify)
- **Decision:** Use ScrapeCreators' Facebook Ad Library endpoint for competitor ads.
- **Context:** Need commercial Meta ad data; owner wants free tools.
- **Options:** Apify Ad Library scraper (~$0.001/ad); ScrapeCreators (free tier, then paid); Meta Ad Library API (political ads only, unusable).
- **Rationale:** owner chose ScrapeCreators; free tier fits MVP; Meta's own API can't return commercial ads.
- **Status:** Active. Supersedes the earlier Apify choice. **Revisit-by:** if free credits run out or data quality is poor.

### D6 — AI: all-Google Gemini (Claude dropped)
- **Decision:** Gemini for all analysis and reasoning, including native image AND video. Remove Claude from the project.
- **Context:** Owner wants Google + free tools.
- **Options:** Claude; Google Cloud Vision (OCR only); Gemini multimodal.
- **Rationale:** Gemini reasons over image and video natively on a free tier, which also deleted ffmpeg + transcription + the queue (see D7).
- **Status:** Active. **Revisit-by:** if Gemini free-tier limits or quality block the product. (Phase 0 code still uses Claude until the Phase 1 swap.)

### D7 — No heavy video pipeline (Gemini native video)
- **Decision:** No ffmpeg frame extraction, no separate transcription, no external queue. Gemini ingests video directly.
- **Context:** Owner wanted full video analysis; earlier ADR-0001 planned a queue+ffmpeg+ElevenLabs worker.
- **Options:** ADR-0001's queue-driven worker; Gemini native video.
- **Rationale:** Gemini native video makes the heavy pipeline unnecessary and keeps it free/low-ops.
- **Status:** Active. **Supersedes ADR-0001.** Governs: `docs/adr/ADR-0001-*` (Superseded).

### D8 — PIVOT: own-account-first cockpit
- **Decision:** Phase 1 = connect your Meta/Google ad account, pull YOUR data, show an action cockpit. Competitor intel becomes one section (Share of Voice). OAuth pulled forward from Phase 2.
- **Context:** Owner supplied the "Yamin cockpit" reference and said "step 1 = connect accounts, then pull data."
- **Options:** own-account-first; competitor-first (keep, adopt look only); both at once.
- **Rationale:** the reference is an own-account dashboard and the owner prioritized connect-then-pull.
- **Status:** Active. Supersedes the competitor-first Phase 1 spec. Governs: `docs/superpowers/specs/2026-08-25-phase-1-account-cockpit-design.md`.

### D9 — Full 9-section cockpit in v1
- **Decision:** All 9 reference sections ship in v1 (verdict, reads, funnel, will-break, do-this queue, waste, leaderboard, SOV, concepts, history).
- **Context:** Scoping the first cockpit build.
- **Options:** lean action core; core + money/breakage; full cockpit.
- **Rationale:** owner chose completeness over a thin first slice.
- **Status:** Active, **re-affirmed 2026-08-25** after the opportunity analysis
  (`docs/discovery/feature-request-analysis.md`) recommended a leaner core. Owner chose to keep
  all 9. Do not re-litigate. **Revisit-by:** if the build stalls / time-to-usable becomes a problem.
  (Trade-off accepted: weeks, not days, to usable; some sections unvalidated.)

### D10 — Adopt the "Yamin cockpit" design language
- **Decision:** Warm paper palette, Schibsted Grotesk + JetBrains Mono, action-dashboard ethos, "show the working" drawer. Retire Phase 0's indigo/dark look.
- **Context:** Owner provided the reference and said "want UI/UX like this."
- **Options:** keep Phase 0 indigo/dark; adopt the reference.
- **Rationale:** the reference is distinctive and anti-slop; Phase 0's look was generic.
- **Status:** Active. Governs: `DESIGN.md`.

### D11 — Winning signal = longevity + impressions (with fallback)
- **Decision:** Treat long-running, high-impression ads as proven winners; fall back to active + variant-count if impressions/date are unavailable.
- **Context:** No own-performance data in the original competitor-first plan.
- **Options:** longevity+impressions; +manual thumbs; analyze-everything-equally.
- **Rationale:** classic Ad Library arbitrage; needs no owner data. (Now mostly applies to the SOV/competitor section post-pivot.)
- **Status:** Active. **Revisit-by:** once own-account performance data is the primary signal.

### D12 — Write-back safety: manual-apply default, never auto-apply
- **Decision:** Recommendations only stage; applying changes to a live ad account requires an explicit, confirmed action. v1 = show the exact change, owner applies in Meta. No auto-apply.
- **Context:** The cockpit's Apply pushes real money-moving changes.
- **Options:** auto-apply; API write-back with confirm; manual-apply.
- **Rationale:** pausing ads / moving budget is payment-adjacent and irreversible; safety first.
- **Status:** Active. **Revisit-by:** when adding opt-in API write-back (needs dry-run + per-batch confirm + audit). Governs: cockpit spec §7, principle #6.

### D13 — Token storage: app-layer AES-256-GCM in a service-role table
- **Decision:** Store OAuth tokens with app-layer envelope encryption in a service-role-only Postgres table; master key server-env only; server-side OAuth; `AdSource` abstraction; Vercel Cron incremental sync.
- **Context:** OAuth tokens can spend the owner's money (top P1 risk).
- **Options:** app-layer envelope encryption; Supabase Vault; external secrets manager.
- **Rationale:** standard pattern for per-user tokens; in-stack, free, scales; Vault is the wrong shape, external manager is overkill for MVP.
- **Status:** Active. Governs: `docs/adr/ADR-0002-*`.

### D14 — Six design principles adopted
- **Decision:** Decisions over dashboards; show the working over "trust us"; money over metrics; one honest number over five; distinctive over default; confirmed over automatic (on money).
- **Context:** Repeated design/product arguments this session.
- **Rationale:** each was derived from a real call and takes a side.
- **Status:** Active (+1 on probation: "real data over rules of thumb"). Governs: `DESIGN.md §0`.

---

## Superseded / historical
- **ADR-0001** (queue+ffmpeg+ElevenLabs video worker) — superseded by D7.
- **Competitor-first Phase 1 spec** — superseded by D8.
- **Apify data source** — superseded by D5. **Claude as primary AI** — superseded by D6.
