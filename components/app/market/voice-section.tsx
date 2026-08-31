import { getCurrentUser } from "@/lib/app/user";
import { loadCompetitorData } from "@/lib/competitors/data";
import { getUserMetaSession } from "@/lib/meta-sync";
import type { Counted } from "@/lib/competitors/types";

// Competitor Voice: how the market talks, mined from your competitors' REAL ad copy (Facebook Ad
// Library). CTAs and opening hooks are straight counts over real ads; the emotion / offer layer
// comes from the Gemini creative analysis and stays honestly gated until some creatives are
// analyzed. Nothing here is fabricated - it needs a competitor pull first (Competitors tab).

export async function VoiceSection() {
  const user = await getCurrentUser();
  const session = user ? await getUserMetaSession(user.id) : null;
  const data = user ? await loadCompetitorData(user.id, session?.activeExternalId ?? null) : null;

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
        <h2 className="text-[22px] font-normal tracking-tight">Competitor Voice</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-muted)]">
          How the market talks - the CTAs and opening lines your rivals lead with, and the messaging
          whitespace you are not using. Add competitors on the Competitors tab and run the pull first;
          then this reads their real ad copy. Nothing is shown until real Ad Library data flows.
        </p>
      </div>
    );
  }

  const v = data.voice;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-normal tracking-tight">Competitor Voice</h2>
        <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
          How the market talks, from {v.competitorAdCount} competitor ad{v.competitorAdCount === 1 ? "" : "s"} across{" "}
          {v.competitorBrandCount} brand{v.competitorBrandCount === 1 ? "" : "s"}. Every line is a count over real Ad Library copy.
        </p>
      </div>

      {/* How they open */}
      <Card title="How competitors open" hint="The opening lines rivals lead with, most-repeated first.">
        {v.competitorHooks.length > 0 ? (
          <ul className="space-y-2.5">
            {v.competitorHooks.map((h) => (
              <li key={h.label} className="flex items-start justify-between gap-3 border-t border-[var(--surface-alt)] pt-2.5 first:border-t-0 first:pt-0">
                <span className="text-[13px] text-[var(--ink)]">&#8220;{h.label}&#8221;</span>
                <span className="shrink-0 text-[11px] tabular-nums text-[var(--ink-muted)]">{h.count} ad{h.count === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[var(--ink-muted)]">No opening-line copy on the pulled ads.</p>
        )}
      </Card>

      {/* CTA voice: what the market says vs you */}
      <Card title="CTAs the market uses" hint="The calls-to-action across competitors, and the ones you are not running.">
        <BarList items={v.competitorCtas} />
        {v.ctaWhitespace.length > 0 && (
          <div className="mt-4 border-t border-[var(--surface-alt)] pt-3.5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">Whitespace - competitors use, you don&apos;t</div>
            <div className="flex flex-wrap gap-2">
              {v.ctaWhitespace.map((c) => (
                <span key={c} className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-1 text-[12px] text-[var(--accent)]">{c}</span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Deeper voice: emotions / offers / hook types, from the Gemini creative analysis. */}
      {v.analyzedCount > 0 ? (
        <Card title="Angles and offers" hint={`From ${v.analyzedCount} creatives read by the AI analysis.`}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <MiniList label="Emotions" items={v.emotions} />
            <MiniList label="Offers" items={v.offers} />
            <MiniList label="Hook types" items={v.hookTypes} />
          </div>
        </Card>
      ) : (
        <div className="rounded-[10px] border border-dashed border-[var(--hairline)] bg-[var(--surface)] p-5 text-[13px] text-[var(--ink-muted)]">
          The emotional angle and offer layer unlocks once the AI creative analysis has read some competitor creatives. Run
          &ldquo;Run AI analysis&rdquo; on the Competitors tab to add it - the CTA and hook voice above needs no analysis.
        </div>
      )}
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
      <div className="mb-1 text-base font-normal">{title}</div>
      <div className="mb-4 text-[13px] text-[var(--ink-muted)]">{hint}</div>
      {children}
    </div>
  );
}

// Horizontal bar list scaled to the max count in the set.
function BarList({ items }: { items: Counted[] }) {
  if (items.length === 0) return <p className="text-[13px] text-[var(--ink-muted)]">No CTA data on the pulled ads.</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
            <span className="font-medium">{i.label}</span>
            <span className="tabular-nums text-[var(--ink-muted)]">{i.count} ad{i.count === 1 ? "" : "s"}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-alt)]">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max((i.count / max) * 100, 3)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniList({ label, items }: { label: string; items: Counted[] }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{label}</div>
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.slice(0, 6).map((i) => (
            <li key={i.label} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="capitalize text-[var(--ink)]">{i.label}</span>
              <span className="tabular-nums text-[var(--ink-muted)]">{i.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-[var(--ink-muted)]">-</p>
      )}
    </div>
  );
}
