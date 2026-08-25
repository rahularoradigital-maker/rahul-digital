# AdBrain — Creative Decision Intelligence (MVP Design)

**Date:** 2026-08-25
**Status:** Approved design, ready for implementation planning
**Working name:** AdBrain (placeholder — real brand TBD before public launch)
**Inspiration:** deepsolv.ai (we replicate the *product capabilities and site structure*, NOT deepsolv's brand, name, logo, or copy)

---

## 1. What we are building

A SaaS that tells Meta/Google advertising teams **what creative to test next, and why** — before they spend money on it. The differentiator versus generic "AI ad generators" and "reporting dashboards" is a **Brand Brain**: a knowledge graph of everything the system learns about ads, competitors, and what works in a niche.

Core promise (borrowed problem framing): *"Ideas are not the problem. 'Which one?' is the real problem."*

### Who it is for
- Consumer brands running Meta/Google ads
- Agencies managing ads for multiple brands

### The one-line value
Enter your niche and competitors → get a ranked, evidence-backed weekly test plan.

---

## 2. Constraints that shaped this design

| Constraint | Consequence |
|---|---|
| **Non-technical builder** | Stack must be managed/low-ops. Claude writes & runs all code. No self-hosted infra, no devops. |
| **Goal = real MVP for first users** | Ship a genuinely usable thin slice, not a prototype and not the full platform. |
| **Has: Claude/OpenAI API key, real Meta + Google ad account access** | AI is available. Live-account OAuth is possible but needs app review, so it is deferred to Phase 2. |
| **Brand Brain = knowledge graph** | Learned facts are stored as subject–predicate–object triples, not loose text. |

---

## 3. Architecture

### 3.1 Stack (managed, low-ops)
- **Next.js (App Router)** — marketing site + product app in one codebase/repo. Public marketing routes; authenticated product routes.
- **Supabase** — one managed service for **auth + Postgres + file storage**. Row-Level Security scopes data per user.
- **Claude API** — deconstruction, graph reasoning, test-plan generation.
- **Vercel** — hosting; deploy on git push. Free tier is sufficient for MVP.

### 3.2 The Brand Brain (knowledge graph)
Stored as a `triples` table in Postgres — **no separate graph database** (Neo4j etc. is overkill at MVP scale and adds ops we do not want). If graph traversal ever outgrows SQL, that is a future migration, not an MVP concern.

Every analyzed ad and every learned result becomes triples:
- `[Ad #42] --uses--> [UGC hook]`
- `[UGC hook] --outperforms--> [talking-head hook]` in `[skincare]`
- `[Competitor X] --shifted-to--> [price-anchoring angle]`

Each triple carries: `confidence`, `source_type` (deconstruction | result | competitor-scan), `source_id`, `brand_id`, `created_at`. The AI queries this graph to build test plans and cites the triples as evidence. The graph grows every week the product is used.

### 3.3 Data model (Phase 0 + Phase 1)

```
users                (managed by Supabase auth)
brands               id, user_id, name, niche, meta_page_url, created_at
competitors          id, brand_id, name, meta_page_url
competitor_ads       id, brand_id, competitor_id, source, external_ad_id,
                     advertiser_name, creative_url, ad_copy, format,
                     first_seen, raw_json, created_at
triples              id, brand_id, subject, predicate, object,
                     confidence, source_type, source_id, created_at   ← Brand Brain
test_plans           id, brand_id, week_of, status, created_at
test_plan_items      id, plan_id, rank, hypothesis, rationale,
                     confidence, evidence_triple_ids[]
```

All tables scoped by `user_id`/`brand_id` via Supabase RLS so users only see their own data.

---

## 4. Build order (phased — each phase = its own spec → plan → build)

| Phase | Ships | Notes |
|---|---|---|
| **0 — Foundation** | Marketing landing page + auth + DB schema + app shell + Claude wired in | A real URL to show people. Detailed below. |
| **1 — Competitor Intel → Test Plan** | The MVP wedge (no OAuth needed) | Detailed below. |
| **2 — My-Account Analysis** | Connect real Meta/Google account → analyze own ad performance → feed results into Brand Brain | Outline only. Needs OAuth + Meta/Google app review — start that paperwork during Phase 1. |
| **3 — Adam Creative Studio** | Generate hooks/scripts/static-ad concepts using the Brand Brain | Outline only. Built last so it is informed, not generic. |

**Only Phases 0 and 1 are designed in detail here.** Phases 2–3 are roadmap outlines and get their own specs when we reach them.

---

## 5. Phase 0 — Foundation (detailed)

**Goal:** a deployed app with a marketing page, working login, the database, and Claude reachable — nothing product-specific yet.

**Scope:**
1. Next.js project, deployed to Vercel, custom-brand marketing landing page (hero, problem, features overview, comparison table, CTA, footer — same *structure* as deepsolv, original copy/brand).
2. Supabase project: auth (email/password + magic link), the Phase 0 tables, RLS policies.
3. App shell behind auth: nav, empty dashboard, sign-out.
4. Claude API integration proven with one trivial server call (health-check endpoint that returns a Claude completion).

**Success criteria:**
- A stranger can visit the URL, read the landing page, sign up, log in, and land on an (empty) dashboard.
- A server route successfully calls Claude and returns a response.

---

## 6. Phase 1 — Competitor Intel → Test Plan (detailed = the MVP)

**Goal:** a user gets a ranked, evidence-backed weekly test plan from competitor ads.

### 6.1 Flow
1. User creates a **Brand** (name, niche) and adds **competitors** (Meta page URLs / advertiser names).
2. System **fetches competitor ads** for those advertisers (see data spike below).
3. Claude **deconstructs** each ad → hook type, angle, format, emotional driver, claim structure → writes **triples** into the Brand Brain.
4. Claude reads the graph → produces a **ranked weekly test plan**: each item has a hypothesis, rationale, confidence score, and the evidence triples it is based on.
5. **UI** shows: the test plan, the competitor ads behind each recommendation, and a browsable view of the graph.

### 6.2 🔴 First task: the data spike (highest risk)
The **Meta Ad Library API officially returns only political/social-issue ads**, not regular commercial ads. Commercial ad data must come from elsewhere. Before building anything on top, we validate a source, in this order:
1. **Meta Ad Library web scrape** — free but fragile and a ToS gray area.
2. **Paid third-party ad-data provider** — reliable, ~$50–200/mo.
3. **User's connected Meta account (Marketing API)** — reliable for the user's own ads + limited competitor visibility; needs OAuth (overlaps Phase 2).

**We do not build Phase 1 UI/AI on a data source until the spike proves one works.** If only a paid source is viable, that is surfaced to the user as a cost decision — not hidden.

### 6.3 AI design
- **Deconstruction prompt:** takes one ad (creative + copy), returns structured JSON of attributes AND a set of triples. Validated against a schema; retries on malformed output.
- **Test-plan prompt:** takes the brand's niche + a query over the triples graph, returns ranked test items with rationale, confidence, and cited `evidence_triple_ids`.
- Both prompts versioned in the repo. Each has at least one runnable check (a fixture ad in → assert expected shape out).

### 6.4 Success criteria
- For a real niche with 2–3 competitors, the user gets ≥5 ranked test-plan items, each citing at least one real competitor ad as evidence.
- Re-running next week reuses and grows the graph (triples accumulate, are not duplicated).

---

## 7. Testing approach

- Non-trivial logic (deconstruction parsing, triple dedup, ranking) leaves one runnable check behind (assert-based script or small test file; no heavy framework).
- Manual acceptance walk-through per phase against the success criteria above.
- No red deploys: verify locally, then push.

---

## 8. Open questions / risks

| Risk | Plan |
|---|---|
| Commercial ad data source (see 6.2) | Data spike is the first Phase 1 task. May require paid source. |
| Meta/Google app review takes weeks | Start the app-review paperwork during Phase 1 so Phase 2 is not blocked. |
| Claude output reliability | Schema validation + retries; versioned prompts with fixtures. |
| Brand/trademark | Ship under AdBrain (or a chosen real name), never deepsolv's identity. |
| Cost creep (AI + data) | Track per-run token cost; cap ads-per-brand at MVP; surface data-source cost to user. |

---

## 9. Explicitly out of scope for the MVP (YAGNI)

- Multi-org / team seats / role management (one user = one workspace for now)
- Billing/subscriptions (add when there are users willing to pay)
- Live Meta/Google OAuth (Phase 2)
- Creative generation (Phase 3)
- Separate graph database
- Mobile app
