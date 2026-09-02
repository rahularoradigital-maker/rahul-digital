// Growth attribution readback (spec §22, the distribution learning loop): given signup events carrying the
// UTM params Scout stamped on every link (utmLink: medium=scout, campaign=growth, source=platform,
// content=topic/article), report which CONTENT and which SOURCE actually drove signups - so Scout learns what
// works and stops writing what doesn't. Pure + testable. The signup-capture half (reading utm_* on landing and
// storing it on the signup) is a separate wiring in the auth flow; this file is the rollup over those events.

export type SignupEvent = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
};

export type ContentStat = { key: string; source: string; content: string; signups: number };
export type SourceStat = { source: string; signups: number };

export type AttributionReport = {
  totalSignups: number;
  scoutAttributed: number; // signups whose medium=scout (Scout-driven)
  organic: number; // no scout attribution (direct / other)
  bySource: SourceStat[]; // Scout signups by platform, biggest first
  byContent: ContentStat[]; // Scout signups by content/topic, biggest first
  topContent: ContentStat | null;
};

// A signup counts as Scout-driven only when its medium is "scout" (what utmLink stamps). Everything else is
// organic/other - never over-claim Scout's credit (§113: learn from outcomes, not from wishful attribution).
function isScout(e: SignupEvent): boolean {
  return (e.utmMedium ?? "").toLowerCase() === "scout";
}

export function attributeSignups(events: SignupEvent[]): AttributionReport {
  const totalSignups = events.length;
  const scout = events.filter(isScout);
  const bySourceMap = new Map<string, number>();
  const byContentMap = new Map<string, { source: string; content: string; signups: number }>();

  for (const e of scout) {
    const source = (e.utmSource ?? "unknown").toLowerCase();
    const content = (e.utmContent ?? "unknown").toLowerCase();
    bySourceMap.set(source, (bySourceMap.get(source) ?? 0) + 1);
    const key = `${source}::${content}`;
    const c = byContentMap.get(key) ?? { source, content, signups: 0 };
    c.signups++;
    byContentMap.set(key, c);
  }

  const bySource = [...bySourceMap.entries()].map(([source, signups]) => ({ source, signups })).sort((a, b) => b.signups - a.signups);
  const byContent = [...byContentMap.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.signups - a.signups);

  return {
    totalSignups,
    scoutAttributed: scout.length,
    organic: totalSignups - scout.length,
    bySource,
    byContent,
    topContent: byContent[0] ?? null,
  };
}
