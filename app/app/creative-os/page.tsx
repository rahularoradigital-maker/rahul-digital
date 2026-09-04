import { getCurrentUser } from "@/lib/app/user";
import { loadPatterns, loadOpportunities } from "@/lib/creative-os/store";
import { categoryMap, whiteSpace } from "@/lib/creative-os/category";
import { detectOpportunities } from "@/lib/creative-os/opportunity";
import { buildBlueprints } from "@/lib/creative-os/strategist";
import { PATTERN_TYPES } from "@/lib/creative-os/schema";

// Creative Intelligence OS — the visible section. Server-rendered read of the creative database + the pure
// engines (category white-space, opportunity detection, strategist blueprints). Shows an honest empty state
// until a research pass has populated patterns. No AI, no live pull on this page.
export const dynamic = "force-dynamic";

const card = "rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-5";
const sectionLabel = "text-[13px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]";

function Bars({ rows }: { rows: { name: string; count: number; share: number }[] }) {
  if (!rows.length) return <p className="text-[13px] text-[var(--ink-muted)]">None yet.</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-1.5">
      {rows.slice(0, 8).map((r) => (
        <div key={r.name} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-2 text-[12px]">
          <span className="truncate text-[var(--ink)]" title={r.name}>{r.name}</span>
          <span className="h-2 rounded-full bg-[var(--surface-alt)]"><span className="block h-2 rounded-full bg-[var(--accent)]" style={{ width: `${Math.round((r.count / max) * 100)}%` }} /></span>
          <span className="text-right tabular-nums text-[var(--ink-muted)]">{Math.round(r.share * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

export default async function CreativeOsPage() {
  const user = await getCurrentUser();
  if (!user) return null; // the /app layout gates auth

  const patterns = await loadPatterns(user.id, {});
  const header = (
    <div>
      <h1 className="text-[26px] font-normal tracking-tight text-[var(--ink)]">Creative Intelligence OS</h1>
      <p className="mt-1 text-[13px] text-[var(--ink-muted)]">
        Market patterns to opportunities to concept blueprints, grounded in real sourced signal, closing the loop with performance.
      </p>
    </div>
  );

  if (!patterns.length) {
    return (
      <div className="space-y-6">
        {header}
        <div className={card}>
          <div className="text-[15px] font-medium text-[var(--ink)]">The pipeline is ready — no patterns extracted yet.</div>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--ink-muted)]">
            Once a research pass runs on a brand + competitors, this page fills with the market&apos;s creative patterns
            ({PATTERN_TYPES.length} types: {PATTERN_TYPES.join(", ")}), the category white-space, ranked opportunities, and
            concept blueprints built from proven patterns.
          </p>
          <p className="mt-3 text-[12px] text-[var(--ink-muted)]">
            Data lands in <code>creative_patterns</code> / <code>opportunities</code>; served by <code>/api/creative-os/*</code>.
          </p>
        </div>
      </div>
    );
  }

  const market = patterns.filter((p) => p.source === "competitor" || p.source === "social");
  const own = patterns.filter((p) => p.source === "own_ad");
  const cm = categoryMap(market.length ? market : patterns);
  const gaps = whiteSpace(market.length ? market : patterns);
  const stored = await loadOpportunities(user.id, "").catch(() => []);
  const opps = stored.length ? stored : detectOpportunities(market.length ? market : patterns);
  const blueprints = buildBlueprints(opps, own.length ? own : patterns);

  return (
    <div className="space-y-8">
      {header}

      <section className="space-y-3">
        <h2 className={sectionLabel}>Category map ({patterns.length} patterns)</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className={card}><div className="mb-3 text-[13px] font-medium text-[var(--ink)]">Personas</div><Bars rows={cm.personas} /></div>
          <div className={card}><div className="mb-3 text-[13px] font-medium text-[var(--ink)]">Angles</div><Bars rows={cm.angles} /></div>
          <div className={card}><div className="mb-3 text-[13px] font-medium text-[var(--ink)]">Formats</div><Bars rows={cm.formats} /></div>
        </div>
      </section>

      {gaps.length > 0 && (
        <section className="space-y-3">
          <h2 className={sectionLabel}>White space (under-used territories)</h2>
          <div className={card}>
            <div className="divide-y divide-[var(--hairline)]">
              {gaps.slice(0, 8).map((g, i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="text-[var(--ink)]">{[g.persona, g.angle, g.format].filter(Boolean).join(" · ") || "—"}</span>
                  <span className="tabular-nums text-[var(--ink-muted)]">{Math.round(g.marketShare * 100)}% of market</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {opps.length > 0 && (
        <section className="space-y-3">
          <h2 className={sectionLabel}>Opportunities</h2>
          <div className="space-y-3">
            {opps.slice(0, 10).map((o, i) => (
              <div key={i} className={card}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-medium text-[var(--ink)]">{[o.persona, o.angle, o.format].filter(Boolean).join(" · ") || "Opportunity"}</span>
                  <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent)]">{Math.round(o.confidence * 100)}% confidence</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-muted)]">{o.thesis}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {blueprints.length > 0 && (
        <section className="space-y-3">
          <h2 className={sectionLabel}>Concept blueprints</h2>
          <div className="space-y-3">
            {blueprints.slice(0, 10).map((b, i) => (
              <div key={i} className={card}>
                <div className="text-[14px] font-medium text-[var(--ink)]">{b.concept}</div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-muted)]"><span className="font-medium text-[var(--ink)]">Test:</span> {b.testingHypothesis}</p>
                {b.hook ? <p className="mt-1 text-[12px] text-[var(--ink-muted)]"><span className="font-medium text-[var(--ink)]">Hook:</span> {b.hook}</p> : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
