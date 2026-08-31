import { rankCreators, type RankedCreator } from "@/lib/influencer/rank";
import { tierOf } from "@/lib/influencer/tiers";
import { SAMPLE_CREATORS, SAMPLE_TARGET } from "@/lib/influencer/sample";
import type { Confidence, TransparentScore, NormalizedCreator, BrandTarget } from "@/lib/influencer/types";

// Influencer Hunt result rendering. The SAME cards render real ScrapeCreators results and the sample preview -
// formula-driven ranking, transparent per-component scores, evidence + confidence on every field, and an
// honest "why this creator". `InfluencerHunt` is the sample preview (used before a run exists); `CreatorCards`
// + `MatchingPanel` are reused by the real results view.

const fmt = (n: number | null): string => {
  if (n === null) return "n/a";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "K";
  return String(n);
};

const CONF: Record<Confidence, { label: string; cls: string }> = {
  high: { label: "high confidence", cls: "bg-[var(--good-bg)] text-[var(--good-ink)]" },
  medium: { label: "medium confidence", cls: "bg-[var(--warn-bg)] text-[var(--warn-ink)]" },
  low: { label: "low confidence", cls: "bg-[var(--surface-alt)] text-[var(--ink-muted)]" },
  none: { label: "no data", cls: "bg-[var(--surface-alt)] text-[var(--ink-muted)]" },
};

function scoreCls(score: number): string {
  if (score >= 70) return "text-[var(--good-ink)]";
  if (score >= 45) return "text-[var(--warn-ink)]";
  return "text-[var(--ink-muted)]";
}
function barCls(score: number): string {
  if (score >= 70) return "bg-[var(--good-ink)]";
  if (score >= 45) return "bg-[var(--warn-ink)]";
  return "bg-[var(--ink-muted)]";
}

const COMPONENT_LABEL: Record<string, string> = {
  brand_fit: "Brand fit",
  audience_fit: "Audience fit",
  content_fit: "Content fit",
  engagement: "Engagement",
  reach: "Reach",
  consistency: "Consistency",
  safety: "Safety",
};

function ConfPill({ c }: { c: Confidence }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CONF[c].cls}`}>{CONF[c].label}</span>;
}

function ScoreBreakdown({ score }: { score: TransparentScore }) {
  return (
    <div className="space-y-1.5">
      {score.components.map((comp) => (
        <div key={comp.key} className="flex items-center gap-2.5">
          <span className="w-24 shrink-0 text-[12px] text-[var(--ink-muted)]">{COMPONENT_LABEL[comp.key] ?? comp.key}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-alt)]">
            <div className={`h-full rounded-full ${barCls(comp.score)}`} style={{ width: `${Math.round(comp.score)}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[12px] font-medium tabular-nums">{Math.round(comp.score)}</span>
          <span className="w-14 shrink-0 text-right text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">×{comp.weight.toFixed(2)}</span>
        </div>
      ))}
      <p className="pt-1 text-[11px] leading-relaxed text-[var(--ink-muted)]">{score.formula}</p>
    </div>
  );
}

// The raw reel numbers behind the reach + consistency scores, e.g. "avg 62K views/reel · 5.1x reach · 3
// reels/week · posted 2d ago". Null when the creator has no usable reel sample.
function reelLine(c: NormalizedCreator): string | null {
  const r = c.reels;
  if (!r || r.confidence === "none") return null;
  const parts: string[] = [];
  if (r.avgViews != null) parts.push(`avg ${fmt(r.avgViews)} views/reel`);
  if (r.reachRatio != null) parts.push(`${r.reachRatio.toFixed(1)}x reach`);
  if (r.postsPerWeek != null) parts.push(`${r.postsPerWeek} reels/week`);
  if (r.daysSinceLastPost != null) parts.push(r.daysSinceLastPost === 0 ? "posted today" : `posted ${r.daysSinceLastPost}d ago`);
  return parts.length ? parts.join(" · ") : null;
}

function audienceLine(c: NormalizedCreator): string {
  const a = c.audience;
  if (a.basis === "none" || a.source === "UNKNOWN") return "Audience data unavailable";
  const top = a.topCountries[0];
  const parts: string[] = [];
  if (top) parts.push(`${Math.round(top.share * 100)}% ${top.countryCode}`);
  if (a.genderLean) parts.push(`${Math.round(a.genderLean.female * 100)}% women`);
  const lang = a.topLanguages[0];
  if (lang) parts.push(`${Math.round(lang.share * 100)}% ${lang.language}`);
  return parts.join(" · ") || "Directional estimate";
}

function CreatorCard({ r }: { r: RankedCreator }) {
  const c = r.creator;
  const q = r.scorecard.quality;
  const tier = c.followers.value !== null ? tierOf(c.followers.value) : null;
  const risk = r.scorecard.risk;
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <div className="flex items-start gap-4">
        <div className="flex w-14 shrink-0 flex-col items-center gap-1">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--ink)] text-[13px] font-semibold text-white">{r.rank}</span>
          <span className={`text-[22px] font-semibold leading-none ${scoreCls(q.score)}`}>{Math.round(q.score)}</span>
          <span className="text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">quality</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a href={c.identity.profileUrl} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold hover:underline">
              {c.name.value ?? `@${c.identity.handle}`}
            </a>
            {c.verified.value ? <span title="verified" className="text-[var(--accent)]">✓</span> : null}
            <span className="text-[13px] text-[var(--ink-muted)]">@{c.identity.handle}</span>
            {tier ? <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-medium capitalize text-[var(--ink-muted)]">{tier}</span> : null}
          </div>

          <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink)]">
            <span className="font-medium">Why: </span>{r.topReason}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[var(--ink-muted)]">
            <span><span className="font-medium text-[var(--ink)]">{fmt(c.followers.value)}</span> followers</span>
            <span><span className="font-medium text-[var(--ink)]">{c.engagementRate.value !== null ? (c.engagementRate.value * 100).toFixed(1) + "%" : "n/a"}</span> engagement</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-medium text-[var(--ink)]">{audienceLine(c)}</span>
              <ConfPill c={c.audience.confidence} />
            </span>
          </div>

          {reelLine(c) ? (
            <div className="mt-1.5 text-[12px] text-[var(--ink-muted)]">
              <span className="font-medium text-[var(--ink)]">Reels</span> · {reelLine(c)}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`rounded-full px-2 py-0.5 font-medium ${risk.score < 30 ? "bg-[var(--good-bg)] text-[var(--good-ink)]" : risk.score < 55 ? "bg-[var(--warn-bg)] text-[var(--warn-ink)]" : "bg-[var(--surface-alt)] text-[var(--ink-muted)]"}`}>
              Risk {Math.round(risk.score)}
            </span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${c.businessEmail.value ? "bg-[var(--good-bg)] text-[var(--good-ink)]" : "bg-[var(--surface-alt)] text-[var(--ink-muted)]"}`}>
              {c.businessEmail.value ? "Public email listed" : "No public email"}
            </span>
          </div>
        </div>

        <div className="hidden w-[280px] shrink-0 border-l border-[var(--hairline)] pl-4 lg:block">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Score breakdown</span>
            <ConfPill c={q.confidence} />
          </div>
          <ScoreBreakdown score={q} />
        </div>
      </div>
    </div>
  );
}

/** The ranked shortlist. Reused by the real results view and the sample preview. */
export function CreatorCards({ ranked }: { ranked: RankedCreator[] }) {
  return (
    <div className="space-y-3">
      {ranked.map((r) => (
        <CreatorCard key={r.creator.identity.platformUserId} r={r} />
      ))}
    </div>
  );
}

/** "Matching creators against" panel - shows the brand target the engine ranked against. */
export function MatchingPanel({ target }: { target: BrandTarget }) {
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Matching creators against</div>
      <div className="mt-2 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
        <div><span className="text-[var(--ink-muted)]">Category:</span> <span className="font-medium">{target.category ?? "n/a"}</span></div>
        <div><span className="text-[var(--ink-muted)]">Sells to:</span> <span className="font-medium">{target.targetCountry ?? "n/a"}{target.personaGender ? ` · ${target.personaGender === "f" ? "women" : "men"}` : ""}</span></div>
        <div><span className="text-[var(--ink-muted)]">Products:</span> <span className="font-medium">{target.keyProducts.length ? target.keyProducts.join(", ") : "n/a"}</span></div>
        <div><span className="text-[var(--ink-muted)]">Needs formats:</span> <span className="font-medium">{target.requiredFormats.join(", ")}</span></div>
      </div>
      <p className="mt-3 text-[12px] text-[var(--ink-muted)]">
        Ranked purely by the quality formula (brand fit, audience fit, content fit, engagement, safety) - never by follower count, so a
        smaller, on-brand creator can outrank a large off-brand one.
      </p>
    </div>
  );
}

/** Sample preview - used before any real run exists. Runs the real engine on clearly-labelled sample data. */
export function InfluencerHunt() {
  const ranked = rankCreators(SAMPLE_CREATORS, SAMPLE_TARGET);
  return (
    <div className="space-y-6">
      <div className="rounded-[10px] border border-[var(--warn-ink)]/25 bg-[var(--warn-bg)] px-4 py-3 text-[13px] text-[var(--warn-ink)]">
        <span className="font-semibold">Preview with sample creators.</span> The ranking, scores, and confidence are produced by the real
        engine, but these creators are sample data, not real accounts. Run a hunt above to rank your brand&apos;s real creators. Nothing is
        fabricated: every field carries its source and confidence.
      </div>
      <MatchingPanel target={SAMPLE_TARGET} />
      <CreatorCards ranked={ranked} />
    </div>
  );
}
