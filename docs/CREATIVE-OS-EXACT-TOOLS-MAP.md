# Creative Intelligence OS — exact-tools integration map

**Date:** 2026-09-03 · **Status:** PLAN — no code, no external calls, no credits spent yet. Asks before anything with cost, a key, or a migration.

Your diagram is an **agent-orchestration** shape: *Wispr Flow (your voice) → a personal AI agent → named tools → performance memory → next strategy.* Below is each exact tool, mapped to reality: is it reachable now, does it need your account/key, or is it an input method — and in which of the two modes it belongs.

---

## The one distinction that decides everything: two modes

**Mode A — Agent-time (Wispr Flow → Claude Code + MCP tools). THIS is your diagram.**
You speak (Wispr Flow); **I (Claude Code) am the "Personal AI Agent"**; I orchestrate the MCP tools already connected in this environment and write results into your creative database. Works **now**, no deploy, for the tools marked ✅ below.

**Mode B — Product-time (the deployed AdScale app uses the tool for end users).**
Each tool's API is integrated into the Next.js app with a key in Vercel env. Heavier, per-tool, needs keys — do this only for tools that must run for *customers*, not just for you.

**Recommendation:** run the OS in **Mode A now** (you + me + the live MCPs) feeding one shared **creative database**; graduate a tool to Mode B only when a customer needs it. This gets the loop turning this week instead of after months of integrations.

---

## Exact tools → status → where they fit

| Tool (your diagram) | OS box | Reachable now? | Mode | Notes |
|---|---|---|---|---|
| **Wispr Flow** | input | N/A (your mic) | A | Voice-to-text input method; nothing to integrate server-side — it's how you talk to the agent. |
| **Claude Code** | the agent / build | ✅ (me) | A+B | Orchestrates tools (A) and builds/modifies the app (B). |
| **Apify** | Research | ✅ **connected now** | A | `call-actor` (any scraper: IG/TikTok/Amazon/…), `rag-web-browser` (Google search+scrape). Your account's credits. |
| **ScrapeCreators** | Research / Competitive Intel | ✅ **connected now** | A | Huge: TikTok/IG/YouTube/Reddit/FB **Ad Library**, transcripts, comments. ⚠️ memory says it was **out of credits** — may fail until topped up; Apify is the fallback. App already has `lib/scrapecreators.ts`. |
| **Meta Ads MCP** | Competitive Intel + **Meta Test** | ✅ **connected now** | A | Ad Library search + `ads_create_creative` / `ads_creative_upload_video/image` — this is the **"Meta test" push path** (DRAFTS-only rule holds: push as paused draft). |
| **Gemini** | Creative Intelligence | ✅ (app key) | A+B | Already the app's text+vision model (`lib/gemini.ts`, deep-decode). Pattern/hook/persona/angle detection runs here. |
| **Perplexity** | Research | ❌ not connected | A/B | External API, needs your key. Substitute available now: Apify `rag-web-browser` + WebSearch. |
| **Kalodata** (TikTok Shop analytics) | Research | ❌ no public API/MCP found | manual | Likely export/manual, or a paid API if one exists — needs your account; confirm it has an API before we plan on it. |
| **Motion** (creative analytics) | Research | ❌ not connected | B | External; API availability unconfirmed — needs your account + key. |
| **Figma agent** | Production | 🔑 present **but needs auth** | A/B | `plugin:design:figma` MCP exists; you authorize it via connector settings, then I can drive Figma. |
| **ElevenLabs** | Production (voice) | ❌ not connected | B | Clean API; needs your key. Easy Mode-B integration when you want voice. |
| **Higgsfield** (video) | Production (video) | ❌ not connected | B | External; API/access needs confirming + your key. |
| **Dropbox agent** | Asset Intelligence | 🟡 a file MCP is present but it looks like **Google Drive**, not Dropbox | A | Confirm Dropbox vs Drive; a Drive MCP (`create/download/share_file`) can serve "asset intelligence" now. |
| **Specialized agents** (UGC/podcast/street/unboxing) | Specialized | ❌ format templates, not tools | B | These are **prompt/format presets** over the production tools, not separate integrations — build as Studio format templates. |
| **Performance Memory → Learnings → Next Strategy** | memory loop | ✅ **in the app** | B | This is the closed loop from the prior plan: `ad_metrics` + rollups + `lib/intelligence/{outcome,predict,grade}` → the creative DB's per-pattern win-rate. |

---

## What this means concretely

- **Available to start the loop TODAY (Mode A, no new accounts):** Apify + ScrapeCreators + Meta Ad Library for research/competitive intel, Gemini for pattern/hook/persona/angle detection, Meta Ads MCP for the test-push. That covers **Research → Creative Intelligence → (Meta) Test** end-to-end, agent-driven.
- **Need your key/account before they can be used:** Perplexity, ElevenLabs, Higgsfield, Motion, Kalodata, and Figma (authorize the connector).
- **Not integrations at all:** Wispr Flow (your voice in), the "specialized agents" (they're format presets over the production tools).
- **The spine is still the gap:** all this research has nowhere unified to land until the **`creative_patterns` table** from the build map exists. That table is the landing zone that turns tool output into compounding memory.

---

## Recommended first move (agent-time, real)

**Run one live research→pattern pass for one brand**, using the tools connected now, and land the output as structured patterns:
1. You name a brand + 2–3 competitors (or a product/category).
2. I pull their ads/creatives via **Meta Ad Library + Apify/ScrapeCreators**, and reviews/comments for voice-of-customer.
3. **Gemini** extracts hooks / angles / objections / personas / proof into the pattern taxonomy.
4. Land them in the **`creative_patterns`** table (needs your green-light on migration `0038`).
5. The Strategist (Studio) then generates concepts from *real, sourced* patterns — and Meta-test-push is one call away.

This is the whole diagram, turning once, with the tools you named — the parts that are reachable now.

---

## Decisions for you
1. **Confirm Mode A** (Wispr Flow → me → live MCPs → creative DB) is the intent for now? (Recommended.)
2. **Green-light migration `0038`** (`creative_patterns`) as the landing zone? Without it, tool output has nowhere unified to go.
3. **Which brand/competitors** should the first live research pass run on?
4. **Which external tools will you provide keys/auth for** (Perplexity / ElevenLabs / Higgsfield / Motion / Kalodata / Figma)? I'll wire each as its key arrives; the loop doesn't wait on them.
5. **Top up ScrapeCreators credits?** (It's the richest social source but reportedly out of credits; Apify covers the gap meanwhile.)
