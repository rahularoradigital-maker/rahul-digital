# 04 — /make-plan Handoff (REDESIGN)

Copy-paste the fenced prompt below into a new session.

````
/make-plan Redesign the AdBrain /app cockpit's presentation layer. Current design failed a Dieter Rams audit at 15/30 with 1-scores in principles #3 aesthetic, #4 understandable, #6 honest, #8 thorough, and #10 as-little-design.

Verdict paragraph (quoted from the audit):
> The cockpit's product logic and information architecture are sound, but its presentation layer fails five of ten principles at once (aesthetic, understandable, honest, thorough, little-design), which is a system-level design failure, not a one-screen blemish — so the design layer should be rebuilt from a single explicit system rather than patched.

Why redesign and not refine: total 15 is below the 20 refine floor, and the five 1-scores share one root cause — there is no enforced design system (spacing, type, and radius are each expressed 3–4 ways; chrome accretes because nothing enforces "less"; states and a11y were never completed). Patching one card cannot fix a missing system.

Preserve from current design (do NOT touch — these are strong):
- Information architecture: the 10-section cockpit flow (context line → Account Health → 4 KPIs → Scaling → Funnel → Action list + Fatigue radar → Leaderboard → Budget waste → Opportunity loss), app/app/page.tsx:122-235.
- The server-rendered data path (cockpit body ships zero client JS; only topbar/switchers/WhyDrawer are client islands), lib/app/cockpit-data.ts + lib/meta-sync.ts.
- The deterministic scoring engines and honest data framing (confidence de-rating banner page.tsx:43-64; "Nothing is applied automatically" ActionList.tsx:76). No fabricated numbers, ever.
- The 14 color tokens in app/globals.css:6-20 (the palette is fine; its inconsistent USAGE is the problem).

Discard (structural patterns causing the failures):
- Ad-hoc spacing/type/radius: card padding across 16/20/22/24px; 8 bespoke text-[Npx] sizes; pill radius in 3 idioms; --radius-card defined but unused. Evidence: Visual §1,2,4. Caused failure on #3 and #10.
- Decorative/dishonest chrome: "Adam · Ranker" fake-agent badge (Leaderboard.tsx:24); non-functional "Ask AdBrain" search (topbar.tsx:39-60); "Live" on a server snapshot (topbar.tsx:33). Caused failure on #6.
- Two permanently-dead MER/nCAC KPI cards (page.tsx:162-169) and duplicate "Live" indicators. Caused failure on #2 and #10.
- Incomplete states: no error.tsx boundary, no success feedback, inconsistent focus/disabled. Caused failure on #8.

Top 5 moves from the audit (verbatim):
1. #3/#10 One enforced design system: one card-padding token (kill 16/20/22/24px mix), one type ramp (kill the 8 bespoke text-[Npx], dedupe text-xl/text-[20px]), one radius rule (use --radius-card/--radius-pill, delete rounded-[70px] literals + rounded-full-as-pill). Evidence: Visual §1,2,4; Structural §3.
2. #6/#4 Honest chrome: remove "Adam · Ranker"; make "Ask AdBrain" functional or a clearly-disabled "coming soon"; rename "Live" → "Real account data · synced <time>"; plain-language MER/nCAC/Concentration/Thumb-stop/insufficient_data. Evidence: Copy §2,4,5.
3. #8 Accessibility floor: darken --accent for text (fails 4.5:1); focus-visible ring on every control incl. AdLink + Ask input; close dropdowns on Escape; add skip-link + aria-label the two <nav>. Evidence: A11y §1,2,3,4,5.
4. #8 Finish states: app-level error.tsx boundary; success confirmation on Re-scan/date change; standardize disabled opacity (40/50/60 → one). Evidence: Visual §5.
5. #2/#10 Cut decoy surface: replace the two dead MER/nCAC cards with one "Connect Shopify to unlock" affordance; drop one "Live". Evidence: Weight §5; Structural §4.

Redesign principles in priority order:
1. As little design as possible (#10) — every chip/card/label must earn its place; default to removing.
2. Honest (#6) — no personas or affordances that claim more than the code does.
3. Aesthetic (#3) — one visible system for spacing, type, radius, color-usage; no arbitrary values.
4. Thorough (#8) — all six states (empty/loading/error/success/focus/disabled) designed, plus the a11y floor.

Deliverables for the plan:
- A tokens spec: the single spacing scale, type ramp, radius rule, and accent-for-text color, written to app/globals.css + a documented usage rule (no arbitrary text-[Npx]/p-[Npx]/rounded-[Npx] in components).
- A component-by-component migration map (page.tsx + components/cockpit/* + topbar/switchers) from current classes to the token system, one file per task.
- States checklist per surface: empty, loading, error (new error.tsx), success (new confirmation), focus (visible ring everywhere), disabled (one opacity).
- An honesty pass on every user-facing string (remove personas, fix "Live", plain-language jargon, resolve the Ask box).
- An accessibility checklist: contrast pass on every text token, focus order, Escape-to-close, skip-link, labeled landmarks.
- Keep the existing check:* gate green and next build green after each task.

Constraints: Next.js 16 + Tailwind; do not add a client UI/animation/chart library; Indian-English, plain, lightly-technical voice; hard rule — never show a number without a real-data-derived formula; no fabricated data.

Anti-patterns to guard against (REDESIGN):
- Porting the old ad-hoc classes under new styling instead of moving to tokens.
- Redesigning the information architecture (it is in the Preserve list — keep it).
- Treating the Preserve list as optional.
- Adding decoration or new personas to "modernize".
````
