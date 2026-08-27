# 01 — Consolidated Evidence

Five evidence subagents (structural, visual, copy/honesty, weight/friction, accessibility). Facts only; every claim carries a source. Rendered-pixel facts are INFERRED from source (dev server is auth-gated).

## Structural
- Cockpit **page body exposes only 2 interactive affordance types**: the "Why?" button (`WhyDrawer.tsx:35`) and the repeated `AdLink` anchor (`AdLink.tsx:27`, rendered in `ActionList.tsx:51`, `FatigueRadar.tsx:59`, `Leaderboard.tsx:41`). All chrome interactivity lives in the topbar/nav (~27 interactive code-sites total).
- **10 top-level sections** scroll in order (`page.tsx:122` children); 7 always render, 3 conditional (ConfidenceBanner, Budget waste, Opportunity loss).
- Max nesting ~14 levels via WhyDrawer's drivers table; main cards stay shallow (5–6).
- **Repeated patterns**: card container `rounded-[10px] border … bg-[var(--surface)]` ×11; pill chips in two idioms — `rounded-[70px]` ×24 and `rounded-[var(--radius-pill)]` ×32; `confColor()` duplicated (`ActionList.tsx:11`, `Leaderboard.tsx:7`); `readCookie()` ×3 (`topbar.tsx:90`, `campaign-switcher.tsx:9`, `objective-switcher.tsx:19`); `rupees` formatter ×2 (`page.tsx:21`, `FunnelCard.tsx:6`); click-outside `useEffect` ×6; three near-identical searchable-dropdown implementations (account/campaign/objective).
- **Zero dead props, zero unused imports** across audited files.

## Visual (INFERRED from source)
- **Spacing**: mostly a 4px scale, but a bespoke **22px** (`p-[22px]`) is mixed with `p-6`/`p-5`/`p-4` so "card padding" alone spans **16/20/22/24px** with no single token (`page.tsx:77,136,195`; `KpiCard.tsx:17`; `Leaderboard.tsx:18`).
- **Type**: heavily bespoke — 8 of 12 sizes are arbitrary `text-[Npx]` (9/11/13/15/20/26/30/38); `text-xl` and `text-[20px]` both = 20px; body leans on off-scale `text-[13px]`/`text-[11px]`.
- **Color**: 14 tokens in `globals.css:6-20`; **light theme only** (no `.dark`, no `prefers-color-scheme`).
- **Radius**: inconsistent — pill written 3 ways for 70px (`rounded-[70px]` literal, `rounded-[var(--radius-pill)]`, `rounded-full`); card hardcodes `rounded-[10px]` while the `--radius-card` token goes unused; plus `rounded-[14px]`/`lg`/`xl`/`md`.
- **States**: empty ✅ (`connect-state.tsx`), loading ✅ (`app/app/loading.tsx`), disabled ✅ (but opacity 40/50/60 inconsistent), error ⚠️ data-level only — **no `error.tsx` boundary anywhere under `app/`**, success ❌ largely missing (no confirmation on Re-scan/date change), focus ⚠️ only 2 controls have custom focus; `AdLink` has no focus ring; the Ask input is `outline-none` with no replacement.

## Copy & Honesty
- **Dark patterns: NONE.** Strong honest framing: "Nothing is applied automatically…" (`ActionList.tsx:76`), the confidence de-rating banner (`page.tsx:43-64`), "n/a means the account did not report that step" (`FunnelCard.tsx:36`).
- **Inflation / persona**: **"Adam · Ranker"** badge on the leaderboard (`Leaderboard.tsx:24`) presents a named "agent" over what the code shows is a deterministic sort.
- **Label→behavior mismatches**: **"Ask AdBrain" search is non-functional** — `onSubmit` only sets a flag and shows a static popover (`topbar.tsx:39-60`); it never queries. **"Live" / "Live · …"** (`topbar.tsx:33`, `page.tsx:127`) implies real-time, but the page is a once-per-request server snapshot (refresh only on Re-scan/date change).
- **Jargon** needing plain replacement: `MER`, `nCAC`, `Concentration`, `Thumb-stop`, `Hold rate`, `insufficient_data` (snake_case leaking to UI, `KpiCard.tsx:26`).

## Weight & Friction
- Cockpit **body is 100% server-rendered** (zero client JS); only islands are topbar + 3 switchers + date-window + 2 nav + WhyDrawer. **~110–140 KB gz** first-load; no heavy client libs; `next.config.ts` empty.
- **~4 Meta Graph round-trips** on default load + 2 client fetches (accounts sessionStorage-cached, campaigns uncached).
- **0 animations on the idle screen** (all `animate-*` are loading/pending only); no `@keyframes` in globals; the "Live" dots are static.
- **~9 always-on chips + 15–30 per-row chips; 0 modals/toasts** on load.

## Accessibility (INFERRED contrast)
- **Contrast**: `--ink`/`--ink-muted` on surfaces PASS. **`--accent` #038bf7 as text FAILS 4.5:1 (~3.5:1)** — used for selected dropdown rows and links (`account-switcher.tsx:122,131`, `campaign-switcher.tsx:105`, `topbar.tsx:177`, `WhyDrawer.tsx:125`); `--good-ink` marginal fail (~4.4:1).
- **Focus**: only mobile hamburger + WhyDrawer have custom focus; most controls rely on UA default; the Ask input suppresses it entirely.
- **Keyboard**: all actions are real `<button>`/`<a>` (good), BUT the four dropdowns **do not close on Escape** and have no focus trap/roving focus; `aria-haspopup="listbox"` without a real `role="listbox"/option`.
- **Landmarks**: 6 (header/main/2 aside/2 nav), but the two `<nav>` are unlabeled duplicates.
- **Skip-link: NONE.**
