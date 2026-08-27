import type { BrandAnalytics, BrandTraffic, MediaCategory } from "@/lib/competitors/types";
import type { CompetitorData as Data } from "@/lib/competitors/data";
import type { CreativeIntel, FunnelMix } from "@/lib/competitors/analytics";
import { AnalyzeControl } from "@/components/app/market/analyze-control";

// Stages 8-9 (deterministic): the Competitor Creative Intelligence dashboard rendered from
// stored, real Ad Library data. Comparison table, format mix, CTA/hook patterns, whitespace
// gaps, and each brand's top live creatives (each linking to the real ad). The 42-attribute
// LLM creative analysis and written SWOT/recommendations (stage 7) are a separate, gated
// layer; nothing here is invented - every number is a count over real ads.

const MEDIA_LABEL: Record<MediaCategory, string> = { video: "Video", image: "Image", carousel: "Carousel", other: "Other" };
const MEDIA_ORDER: MediaCategory[] = ["video", "image", "carousel", "other"];

// The brand's live Facebook Ad Library page, to cross-check what we pulled against source.
function adLibraryUrl(pageId: string): string {
  return `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${pageId}`;
}

function LibraryLink({ pageId }: { pageId: string }) {
  return (
    <a
      href={adLibraryUrl(pageId)}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 rounded-[var(--radius-pill)] border border-[var(--hairline)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      Ad Library ↗
    </a>
  );
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function topCta(b: BrandAnalytics): string {
  return b.ctaMix[0]?.label ?? "-";
}

function fmtDate(unix: number | null): string {
  if (!unix) return "";
  const d = new Date(unix * 1000);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function CompetitorDashboard({ data }: { data: Data }) {
  const { report } = data;
  const brands = [report.myBrand, ...report.competitors].filter(Boolean) as BrandAnalytics[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">Competitor Creative Intelligence</h2>
          <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
            {data.brandCount} brand{data.brandCount === 1 ? "" : "s"} · {data.adCount} live ads from the Facebook Ad Library
            {data.updatedAt ? ` · updated ${fmtDate(Math.floor(new Date(data.updatedAt).getTime() / 1000))}` : ""}
          </p>
        </div>
      </div>

      {/* Comparison table (stage 8) */}
      <div className="overflow-x-auto rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)]">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--hairline)] text-left text-[13px] text-[var(--ink-muted)]">
              <th className="px-[22px] py-3 font-medium">Brand</th>
              <th className="px-4 py-3 text-right font-medium tabular-nums">Live ads</th>
              <th className="px-4 py-3 text-right font-medium tabular-nums">Active</th>
              <th className="px-4 py-3 text-right font-medium tabular-nums">Video</th>
              <th className="px-4 py-3 text-right font-medium tabular-nums">Image</th>
              <th className="px-4 py-3 text-right font-medium tabular-nums">Carousel</th>
              <th className="px-4 py-3 text-right font-medium tabular-nums">New 7d</th>
              <th className="px-4 py-3 font-medium">Top CTA</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.pageId} className="border-b border-[var(--surface-alt)] last:border-b-0">
                <td className="px-[22px] py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{b.label}</span>
                    {b.isMyBrand && (
                      <span className="rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">You</span>
                    )}
                    <LibraryLink pageId={b.pageId} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{b.totalAds}</td>
                <td className="px-4 py-3 text-right tabular-nums">{b.activeAds}</td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-muted)]">{pct(b.formatMix.video, b.totalAds)}%</td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-muted)]">{pct(b.formatMix.image, b.totalAds)}%</td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-muted)]">{pct(b.formatMix.carousel, b.totalAds)}%</td>
                <td className="px-4 py-3 text-right tabular-nums">{b.newLast7Days}</td>
                <td className="px-4 py-3 text-[var(--ink)]">{topCta(b)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Whitespace / gaps (stage 8, deterministic) */}
      {report.myBrand && (report.gaps.formats.length > 0 || report.gaps.ctas.length > 0) && (
        <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
          <div className="mb-1 text-base font-semibold">Whitespace vs your brand</div>
          <div className="mb-3 text-[13px] text-[var(--ink-muted)]">
            Formats and CTAs your competitors run that {report.myBrand.label} does not. A factual gap, not advice.
          </div>
          <div className="flex flex-wrap gap-2">
            {report.gaps.formats.map((f) => (
              <span key={f} className="rounded-[var(--radius-pill)] bg-[var(--warn-bg)] px-3 py-1 text-xs font-medium text-[var(--warn-ink)]">
                {MEDIA_LABEL[f]} format
              </span>
            ))}
            {report.gaps.ctas.map((c) => (
              <span key={c} className="rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-3 py-1 text-xs font-medium text-[var(--ink)]">
                {c} CTA
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Ad traffic distribution: where each brand sends its ad clicks (landing-page hosts) */}
      {report.trafficByBrand.length > 0 && <TrafficSection traffic={report.trafficByBrand} />}

      {/* Longest-running creatives = proven winners (brands keep what works) */}
      <LongRunningSection brands={brands} />

      {/* Stage 7 trigger + AI creative intelligence */}
      <AnalyzeControl analyzedCount={report ? (data.creativeIntel?.analyzedCount ?? 0) : 0} />
      {data.creativeIntel && <CreativeIntelSection intel={data.creativeIntel} />}

      {/* Per-brand detail (stages 4-6 + top creatives) */}
      {brands.map((b) => (
        <BrandCard key={b.pageId} brand={b} />
      ))}
    </div>
  );
}

function FunnelBar({ f }: { f: FunnelMix }) {
  const total = f.tof + f.mof + f.bof + f.unknown || 1;
  const seg = (n: number, cls: string, label: string) =>
    n > 0 ? <div className={cls} style={{ width: `${(n / total) * 100}%` }} title={`${label}: ${n}`} /> : null;
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0 truncate text-[13px]">
        {f.label}
        {f.isMyBrand && <span className="ml-1.5 text-[11px] font-semibold text-[var(--accent)]">(You)</span>}
      </div>
      <div className="flex h-3 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface-alt)]">
        {seg(f.tof, "bg-[var(--accent)]", "TOF")}
        {seg(f.mof, "bg-[var(--warn-ink)]", "MOF")}
        {seg(f.bof, "bg-[var(--good-ink)]", "BOF")}
        {seg(f.unknown, "bg-[var(--hairline)]", "Unclassified")}
      </div>
      <div className="w-28 shrink-0 text-right text-xs tabular-nums text-[var(--ink-muted)]">
        {f.tof}/{f.mof}/{f.bof}
      </div>
    </div>
  );
}

function Patterns({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{title}</div>
      <div className="space-y-1.5">
        {items.length === 0 && <div className="text-[13px] text-[var(--ink-muted)]">Not detected yet</div>}
        {items.slice(0, 6).map((i) => (
          <div key={i.label} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="truncate text-[var(--ink)]">{i.label}</span>
            <span className="tabular-nums text-[var(--ink-muted)]">{i.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreativeIntelSection({ intel }: { intel: CreativeIntel }) {
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold">Creative intelligence</span>
        <span className="rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
          Gemini · {intel.analyzedCount} analyzed
        </span>
      </div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
        Funnel mix (TOF / MOF / BOF) per brand and the hook, offer, and emotion patterns across analyzed creatives.
      </div>

      <div className="mb-5 space-y-2">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
          Funnel mix · TOF / MOF / BOF
        </div>
        {intel.funnelByBrand.map((f) => (
          <FunnelBar key={f.label} f={f} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 border-t border-[var(--surface-alt)] pt-4 md:grid-cols-3">
        <Patterns title="Hook types" items={intel.hookTypes} />
        <Patterns title="Offers" items={intel.offers} />
        <Patterns title="Emotions" items={intel.emotions} />
      </div>
    </div>
  );
}

function TrafficSection({ traffic }: { traffic: BrandTraffic[] }) {
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-1 text-base font-semibold">Where competitors send traffic</div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
        Each brand's ad clicks by landing-page destination - own D2C site vs the big marketplaces and app stores.
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {traffic.map((b) => (
          <div key={b.label}>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
              <span className="truncate">{b.label}</span>
              {b.isMyBrand && <span className="text-[var(--accent)]">(You)</span>}
            </div>
            <div className="space-y-1.5">
              {b.destinations.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="truncate text-[var(--ink)]">{d.label}</span>
                  <span className="tabular-nums text-[var(--ink-muted)]">
                    {d.count} · {d.pct}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function daysRunning(startUnix: number | null): number {
  if (!startUnix) return 0;
  return Math.max(0, Math.floor((Date.now() - startUnix * 1000) / 86_400_000));
}

// Longest-running ACTIVE creatives across all brands: a strong proxy for what works, since a
// brand does not keep a loser live for months. Deterministic (start date + still active).
function LongRunningSection({ brands }: { brands: BrandAnalytics[] }) {
  const ads = brands
    .flatMap((b) => b.topCreatives.map((ad) => ({ ad, brand: b.label })))
    .filter((x) => x.ad.isActive && x.ad.startDate)
    .map((x) => ({ ...x, days: daysRunning(x.ad.startDate) }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 8);
  if (ads.length === 0) return null;
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-1 text-base font-semibold">Longest-running creatives</div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">
        Active ads a brand has kept live the longest - a strong proxy for what is working (brands do not keep losers running).
      </div>
      <div className="space-y-2">
        {ads.map(({ ad, brand, days }) => (
          <a
            key={ad.adArchiveId}
            href={ad.adUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 border-t border-[var(--surface-alt)] pt-2 first:border-t-0 first:pt-0"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-[var(--ink)]">{ad.title || ad.body?.slice(0, 60) || `Ad ${ad.adArchiveId}`}</div>
              <div className="truncate text-[11px] text-[var(--ink-muted)]">
                {brand} · {MEDIA_LABEL[ad.media]}
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--ink)]">{days}d live</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function BrandCard({ brand }: { brand: BrandAnalytics }) {
  return (
    <div className="rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] p-[22px]">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold">{brand.label}</span>
        {brand.isMyBrand && (
          <span className="rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">You</span>
        )}
        <span className="text-[13px] text-[var(--ink-muted)]">
          {brand.activeAds} active · {brand.inactiveAds} inactive
        </span>
        <span className="flex-1" />
        <LibraryLink pageId={brand.pageId} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
        {/* Platform mix (where this brand runs) */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Platforms</div>
          <div className="space-y-1.5">
            {brand.platformMix.length === 0 && <div className="text-[13px] text-[var(--ink-muted)]">None detected</div>}
            {brand.platformMix.slice(0, 5).map((p) => (
              <div key={p.label} className="flex items-center justify-between text-[13px]">
                <span className="truncate capitalize text-[var(--ink)]">{p.label.toLowerCase()}</span>
                <span className="tabular-nums text-[var(--ink-muted)]">{pct(p.count, brand.totalAds)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Format mix */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Format mix</div>
          <div className="space-y-1.5">
            {MEDIA_ORDER.filter((m) => brand.formatMix[m] > 0).map((m) => (
              <div key={m} className="flex items-center justify-between text-[13px]">
                <span className="text-[var(--ink)]">{MEDIA_LABEL[m]}</span>
                <span className="tabular-nums text-[var(--ink-muted)]">
                  {brand.formatMix[m]} · {pct(brand.formatMix[m], brand.totalAds)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top CTAs */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Top CTAs</div>
          <div className="space-y-1.5">
            {brand.ctaMix.length === 0 && <div className="text-[13px] text-[var(--ink-muted)]">None detected</div>}
            {brand.ctaMix.slice(0, 5).map((c) => (
              <div key={c.label} className="flex items-center justify-between text-[13px]">
                <span className="truncate text-[var(--ink)]">{c.label}</span>
                <span className="tabular-nums text-[var(--ink-muted)]">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top hooks */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Most-used hooks</div>
          <div className="space-y-1.5">
            {brand.topHooks.length === 0 && <div className="text-[13px] text-[var(--ink-muted)]">No copy detected</div>}
            {brand.topHooks.slice(0, 5).map((h) => (
              <div key={h.label} className="truncate text-[13px] text-[var(--ink-muted)]" title={h.label}>
                {h.count > 1 ? `${h.count}x ` : ""}
                {h.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live creatives, shown as cards like the Facebook Ad Library; each opens the real ad. */}
      {brand.topCreatives.length > 0 && (
        <div className="mt-5 border-t border-[var(--surface-alt)] pt-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">
            Live creatives (as in the Ad Library)
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {brand.topCreatives.slice(0, 6).map((ad) => (
              <a
                key={ad.adArchiveId}
                href={ad.adUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-[10px] border border-[var(--hairline)] bg-[var(--bg)] transition hover:border-[var(--accent)]"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-[var(--surface-alt)]">
                  {ad.imageUrl || ad.videoThumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.imageUrl ?? ad.videoThumbUrl ?? ""} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-[var(--ink-muted)]">No preview</div>
                  )}
                  <div className="absolute left-2 top-2 flex gap-1">
                    <span className="rounded-[var(--radius-pill)] bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{MEDIA_LABEL[ad.media]}</span>
                    {ad.isActive && (
                      <span className="rounded-[var(--radius-pill)] bg-[var(--good-ink)] px-2 py-0.5 text-[10px] font-semibold text-white">Active</span>
                    )}
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="line-clamp-2 text-[12px] font-medium text-[var(--ink)]">
                    {ad.title || ad.body?.slice(0, 80) || `Ad ${ad.adArchiveId}`}
                  </div>
                  {ad.ctaText && (
                    <span className="mt-1.5 inline-block rounded-[var(--radius-pill)] bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">
                      {ad.ctaText}
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
