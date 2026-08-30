// Growth-agent knowledge base (spec sections 1, 2, 3, 33, 34). The single source of truth for WHO AdScale is,
// WHO it serves, WHAT signals to look for, and WHAT the agent must never do. Versioned - never overwrite,
// bump VERSION on a real change. NOTHING here invents a product capability: every brand fact below is a real,
// shipped part of AdScale (adscaledigital.co). If a capability is not real, it does not go here.

export const KNOWLEDGE_VERSION = "1.0.0";

// --- BRAND KNOWLEDGE (section 1) - honest capabilities only ---
export const BRAND = {
  name: "AdScale",
  url: "https://adscaledigital.co",
  oneLiner: "Creative decision intelligence for Meta + Google ads - it reads your day-wise account data and tells you what to act on today, with a reason for every verdict, and never auto-changes your account.",
  does: [
    "Connects a Meta / Google ad account (read-only, encrypted tokens) and reads day-wise performance.",
    "Gives a triple-labelled verdict on each ad - Evidence (is it judgeable?), Agreement (do the signals concur?), Confidence (how sure) - so a call is auditable, not a black box.",
    "Applies media-buying rigor: no fatigue/kill verdict on an ad that spent too little of its ad set's budget to be judged (materiality); statistical sufficiency before any call.",
    "Ranks 'what to do today' by money at stake, and only on ads that are actually delivering (never a dead/paused entity).",
    "Reads ad-set and campaign at their own native metrics (reach, frequency, budget), not naive roll-ups.",
    "Competitor intelligence from public ad libraries; an AI creative studio for static-ad concepts.",
  ],
  // Boundaries the agent must respect when describing the product (never overclaim).
  doesNot: [
    "Does not auto-apply changes to an ad account - every recommendation is a draft the user actions themselves.",
    "Does not guarantee a specific ROAS lift or fabricate results.",
    "Is not a full media-buying autopilot or an agency replacement.",
  ],
  differentiator: "A reason for every verdict (the triple label), plus buyer-grade rigor (materiality, sufficiency) - judgment, not another dashboard.",
} as const;

// --- ICP (section 2) ---
export const ICPS = [
  { role: "Performance marketer / media buyer", where: "in-house DTC", pain: "drowning in dashboards, unsure what to act on, must defend calls to a VP" },
  { role: "DTC founder / growth lead", where: "$1M-$50M/yr ecommerce", pain: "wasted spend, creative fatigue, no time to read the account daily" },
  { role: "Agency media buyer / owner", where: "runs many client accounts", pain: "same read × N accounts, needs speed + defensible reporting" },
  { role: "Creative strategist", where: "paid social team", pain: "creative fatigue + testing, which creative to refresh next" },
] as const;

// --- INTENT SIGNALS (section 3) - search for INTENT, not just keywords. Grouped by problem the product solves.
export const INTENT_SIGNALS: { topic: string; phrases: string[]; adscaleFit: number }[] = [
  { topic: "creative fatigue", phrases: ["creative fatigue", "ads fatiguing faster", "frequency too high", "ad creative dying", "when to refresh creative"], adscaleFit: 0.95 },
  { topic: "what to scale/kill", phrases: ["when to kill an ad", "when to scale", "should i pause this ad", "how to know if an ad is working"], adscaleFit: 0.95 },
  { topic: "ROAS / efficiency drop", phrases: ["roas dropped", "cpa went up", "meta performance tanked", "why did my ads stop working"], adscaleFit: 0.85 },
  { topic: "reporting / dashboards", phrases: ["ads manager is confusing", "which metric matters", "dashboard i can trust", "how to report on ads"], adscaleFit: 0.7 },
  { topic: "attribution", phrases: ["attribution is broken", "ios attribution", "can't trust meta numbers"], adscaleFit: 0.5 },
  { topic: "tool comparison", phrases: ["alternative to", "vs triple whale", "best ad analytics tool", "tool for creative testing"], adscaleFit: 0.8 },
  { topic: "AI advertising / automation", phrases: ["ai for ads", "automate ad decisions", "ai media buyer"], adscaleFit: 0.75 },
];

// --- SAFETY: the permanent DO-NOT-DO list (section 34). Guardrails every draft is checked against. ---
export const SAFETY_DONOTDO = [
  "Do not auto-publish anywhere - drafts only, human approval required.",
  "Do not claim unsupported results, ROAS numbers, or case studies.",
  "Do not invent testimonials, customers, or fake conversations.",
  "Do not impersonate a customer, a competitor, or misrepresent affiliation.",
  "Do not mass-post identical content or spam links.",
  "Do not promote where the community forbids it - be useful without forcing AdScale in.",
  "Do not manipulate votes, evade moderation, or bypass platform rules / rate limits.",
  "Always disclose affiliation when mentioning AdScale.",
] as const;

// Seed communities to LISTEN to (read-only discovery). Not for joining-to-promote.
export const SEED_SUBREDDITS = ["PPC", "FacebookAds", "DigitalMarketing", "advertising", "ecommerce", "shopify", "marketing", "GoogleAds"] as const;
