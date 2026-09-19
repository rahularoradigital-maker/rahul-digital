// Version-controlled glossary of performance-marketing terms. Static, no DB, no fabrication: each entry is a
// real, well-established Meta/Google media-buying term with an honest definition. This powers /glossary and
// /glossary/[term] - an AEO/AI-citation surface (answer-first definitions carry DefinedTerm schema) and a
// topic-authority hub that cross-links into the blog cluster and the product. Pure data + helpers (testable).

export type Term = {
  slug: string;
  term: string;
  aka?: string[]; // synonyms / abbreviations, surfaced for search + schema alternateName
  category: string;
  // Answer-first: one self-contained sentence that fully defines the term (what AI engines quote).
  short: string;
  // 1-3 short markdown paragraphs of context. Honest, no invented benchmarks.
  body: string;
  formula?: string; // shown as a mono line when the term is a computed metric
  related?: string[]; // blog article slugs this term links out to
};

export const GLOSSARY: Term[] = [
  {
    slug: "roas",
    term: "ROAS",
    aka: ["Return on ad spend"],
    category: "Efficiency",
    short: "ROAS (return on ad spend) is the revenue attributed to your ads divided by what you spent on them, expressed as a ratio.",
    body: "ROAS answers 'for every unit of currency I spent, how much revenue came back?'. A ROAS of 3 means $3 of attributed revenue per $1 of spend. It is a platform-reported, attribution-dependent number, so the same ads can show different ROAS in Meta, Google, and your store depending on the attribution window and model. Read it alongside a business-level efficiency metric like MER, never on its own.",
    formula: "ROAS = attributed revenue / ad spend",
    related: ["how-to-decide-what-to-change-in-meta-ads"],
  },
  {
    slug: "mer",
    term: "MER",
    aka: ["Media efficiency ratio", "Blended ROAS"],
    category: "Efficiency",
    short: "MER (media efficiency ratio) is total store revenue divided by total ad spend across all channels in the same period.",
    body: "MER is the 'blended' view: it ignores attribution entirely and asks whether total marketing spend is producing total revenue. Because it cannot be inflated by overlapping platform attribution, many D2C operators steer the business on MER and use per-platform ROAS only to allocate within that budget. It is sometimes called blended ROAS.",
    formula: "MER = total revenue / total ad spend",
  },
  {
    slug: "cac",
    term: "CAC",
    aka: ["Customer acquisition cost"],
    category: "Economics",
    short: "CAC (customer acquisition cost) is the total sales and marketing cost to acquire one customer over a period.",
    body: "CAC divides everything you spent to win customers by the number of customers won. Whether you count only ad spend or also tools, agency fees, and salaries changes the number, so define it consistently. CAC is only meaningful next to what a customer is worth over time (LTV) and to new-customer CAC, which strips out repeat buyers.",
    formula: "CAC = acquisition spend / new customers",
  },
  {
    slug: "ncac",
    term: "nCAC",
    aka: ["New-customer CAC", "New customer acquisition cost"],
    category: "Economics",
    short: "nCAC (new-customer CAC) is acquisition cost measured against first-time customers only, excluding repeat buyers.",
    body: "Blended CAC flatters paid performance because returning customers, who often would have bought anyway, are counted in the denominator. nCAC counts only genuinely new customers, so it reflects what acquisition actually costs. It is the honest number for judging whether scaling spend is still profitable, and pairs with new-customer ROAS.",
    formula: "nCAC = acquisition spend / new (first-time) customers",
  },
  {
    slug: "ltv",
    term: "LTV",
    aka: ["Lifetime value", "CLV"],
    category: "Economics",
    short: "LTV (lifetime value) is the total gross profit a customer is expected to generate across their whole relationship with you.",
    body: "LTV turns a one-off purchase into its full economic value by adding expected repeat purchases and subtracting the cost of goods. Compared with CAC as an LTV:CAC ratio, it tells you how much you can afford to pay to acquire a customer. Use gross-profit LTV (after COGS), not revenue, or you will overpay for growth.",
  },
  {
    slug: "aov",
    term: "AOV",
    aka: ["Average order value"],
    category: "Economics",
    short: "AOV (average order value) is total revenue divided by number of orders in a period.",
    body: "AOV is the average amount spent per order. Raising it (bundles, thresholds for free shipping, upsells) lifts ROAS and CAC math without touching the ad account at all, which is why it is a lever media buyers watch even though they do not control it directly.",
    formula: "AOV = revenue / orders",
  },
  {
    slug: "cpa",
    term: "CPA",
    aka: ["Cost per acquisition", "Cost per action", "CPP (cost per purchase)"],
    category: "Efficiency",
    short: "CPA (cost per acquisition) is ad spend divided by the number of conversions (purchases, leads, or the chosen action).",
    body: "CPA is the inverse view of ROAS: instead of revenue per dollar, it is dollars per result. It is the natural north-star for lead-gen and for Search campaigns where value varies, and it is directly comparable across campaigns aiming at the same action. What counts as the 'action' must be fixed, or the number is meaningless.",
    formula: "CPA = ad spend / conversions",
  },
  {
    slug: "cpm",
    term: "CPM",
    aka: ["Cost per mille", "Cost per thousand impressions"],
    category: "Delivery",
    short: "CPM (cost per mille) is the cost to serve one thousand impressions of your ad.",
    body: "CPM is the price of attention in the auction. Rising CPM with flat performance usually means more competition or narrower delivery; falling CPM can signal fresh creative or broader targeting. It is a diagnostic, not a goal: cheap impressions that do not convert are not a win.",
    formula: "CPM = (ad spend / impressions) x 1000",
  },
  {
    slug: "ctr",
    term: "CTR",
    aka: ["Click-through rate"],
    category: "Delivery",
    short: "CTR (click-through rate) is the share of impressions that resulted in a click.",
    body: "CTR measures whether the ad earned the click. On Meta, distinguish all-clicks CTR from link CTR (clicks to your site), which is the one that matters for traffic. A healthy CTR with poor conversion points downstream, to the landing page or offer, not the creative.",
    formula: "CTR = clicks / impressions",
  },
  {
    slug: "frequency",
    term: "Frequency",
    category: "Delivery",
    short: "Frequency is the average number of times each person in your audience saw your ad over a period.",
    body: "Frequency is impressions divided by reach. As it climbs, the same people see the same ad repeatedly, and response usually decays, the mechanism behind creative fatigue. Read frequency against a fixed window and against each ad's own baseline, because the level that fatigues an audience depends on the creative and the audience size.",
    formula: "Frequency = impressions / reach",
    related: ["meta-ads-creative-fatigue-signals", "how-often-refresh-meta-ad-creative"],
  },
  {
    slug: "creative-fatigue",
    term: "Creative fatigue",
    aka: ["Ad fatigue"],
    category: "Creative",
    short: "Creative fatigue is the decline in an ad's performance that happens as the same audience sees it too many times.",
    body: "Fatigue shows up as rising frequency and CPM with falling CTR and engagement, and eventually a climbing cost per result. Caught early from day-wise signals, it is a prompt to refresh the creative before cost per result doubles. Caught late, it looks like a targeting or bidding problem and gets misdiagnosed.",
    related: ["meta-ads-creative-fatigue-signals", "how-often-refresh-meta-ad-creative"],
  },
  {
    slug: "thumb-stop-rate",
    term: "Thumb-stop rate",
    aka: ["Hook rate", "3-second video play rate"],
    category: "Creative",
    short: "Thumb-stop rate (hook rate) is the share of impressions where someone stopped scrolling to watch the first few seconds of your video.",
    body: "It is usually measured as 3-second video plays divided by impressions, and it isolates the opening 'hook' of the creative. A weak thumb-stop rate means the first frames failed regardless of how good the rest is, so it is the first thing to fix on an underperforming video ad.",
    formula: "Thumb-stop rate = 3-second video plays / impressions",
    related: ["meta-ads-creative-fatigue-signals"],
  },
  {
    slug: "hold-rate",
    term: "Hold rate",
    aka: ["Watch-through", "Retention rate"],
    category: "Creative",
    short: "Hold rate is the share of viewers who keep watching a video ad past a set point, such as 15 seconds or to completion.",
    body: "Where thumb-stop rate measures the hook, hold rate measures whether the ad kept attention. Reading them as a 2x2, hooked-and-held, hooked-not-held, and so on, tells you whether to fix the opening or the body of the creative. A retention curve that drops off a cliff pinpoints the exact second viewers leave.",
  },
  {
    slug: "impression-share",
    term: "Impression share",
    aka: ["IS", "Search impression share"],
    category: "Google",
    short: "Impression share is the percentage of the impressions your ads were eligible for that they actually received.",
    body: "A Google Ads metric: if you got 6,000 of a possible 10,000 impressions, impression share is 60%. The 40% you missed is split into lost-to-budget and lost-to-rank, which is the single most useful diagnostic in Search, it tells you whether to raise budget on a winner or fix Ad Rank, rather than guessing.",
    related: ["how-to-decide-what-to-change-in-meta-ads"],
  },
  {
    slug: "quality-score",
    term: "Quality Score",
    category: "Google",
    short: "Quality Score is Google's 1-10 estimate of the quality of your keyword, ad, and landing page relative to other advertisers.",
    body: "Quality Score bundles expected click-through rate, ad relevance, and landing-page experience. A low score on real spend raises what you pay per click and can cost you the auction outright, so the fix is to address the weakest of its three components, ranked by the money it would save, rather than to bid harder.",
  },
  {
    slug: "learning-phase",
    term: "Learning phase",
    category: "Delivery",
    short: "The learning phase is the initial period when an ad set's delivery system is still optimising and performance is unstable.",
    body: "On both Meta and Google, a new or recently-edited campaign explores before it settles, and results during this window are not representative. Making a bid or budget change while it is still learning resets the process and costs you, so a disciplined system will not issue a change recommendation until learning is complete.",
  },
  {
    slug: "target-roas",
    term: "Target ROAS",
    aka: ["tROAS"],
    category: "Google",
    short: "Target ROAS (tROAS) is a Smart Bidding strategy where you set a return goal and Google bids to hit it on average.",
    body: "Instead of bidding to cost, you tell Google the ROAS you want and it sets bids to reach it across conversions. It only works once a campaign has enough conversions and enough distinct conversion values for the model to learn, so moving to it too early hurts. Judging that readiness is a real decision, not a default.",
  },
  {
    slug: "incrementality",
    term: "Incrementality",
    aka: ["Incremental lift"],
    category: "Measurement",
    short: "Incrementality is the extra conversions your ads actually caused, beyond what would have happened without them.",
    body: "Attribution credits ads for conversions that touched them; incrementality asks the harder question of which conversions would not have occurred otherwise. A retargeting ad can show a high ROAS while adding little incremental revenue. Lift tests (holding out a group) are the honest way to measure it, and it is the truest test of whether spend is working.",
  },
];

export function allTerms(): Term[] {
  return [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
}

export function getTerm(slug: string): Term | undefined {
  return GLOSSARY.find((t) => t.slug === slug);
}

export function termsByCategory(): { category: string; terms: Term[] }[] {
  const map = new Map<string, Term[]>();
  for (const t of allTerms()) {
    const list = map.get(t.category) ?? [];
    list.push(t);
    map.set(t.category, list);
  }
  return [...map.entries()].map(([category, terms]) => ({ category, terms }));
}
