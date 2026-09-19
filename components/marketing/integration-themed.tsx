"use client";

// Shared themed layout for the integration pages (/integrations/meta, /integrations/google-ads) in the
// marketing theme. Content is passed in per page; metadata stays in each server page. All AdScale's own copy.
import { ThemeShell, SecHead } from "@/components/marketing/theme-shell";

type Row = { k: string; v: string };
type Dec = { h: string; d: string };

export default function IntegrationThemed({
  active, eyebrow, h1, lede, connects, decisions, dataLabel, dataPoints, safe, ctaH, ctaP,
}: {
  active: string; eyebrow: string; h1: string; lede: string;
  connects: Row[]; decisions: Dec[]; dataLabel: string; dataPoints: string[]; safe: Row[]; ctaH: string; ctaP: string;
}) {
  return (
    <ThemeShell active="/product">
      <section className="page-hero">
        <div className="wrap">
          <div className="eyebrow"><span className="tick" /><span className="lab">{eyebrow}</span></div>
          <h1>{h1}</h1>
          <p className="lede">{lede}</p>
          <div className="ctas"><a className="btn solid" href="/book-demo">Book a demo</a><a className="btn" href="/product">See the platform</a></div>
        </div>
      </section>

      <section className="blk">
        <div className="wrap">
          <SecHead num="/ 01" title="What connects." sub="Read-only, through the platform's own login. AdScale can look, never touch." />
          <div className="faq" style={{ borderTop: "1px solid var(--line)" }}>
            {connects.map((r) => (
              <div key={r.k} style={{ display: "grid", gap: 8, padding: "22px 4px", borderBottom: "1px solid var(--line)", gridTemplateColumns: "minmax(200px,260px) 1fr" }} className="rv">
                <div style={{ fontWeight: 600 }}>{r.k}</div>
                <div style={{ color: "var(--muted)", fontSize: 15 }}>{r.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="blk">
        <div className="wrap">
          <SecHead num="/ 02" title="What AdScale decides from it." sub="Judgment, not another dashboard. Every read is auditable, and nothing is applied automatically." />
          <div className="three" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            {decisions.map((d) => (<div className="c rv" style={{ minHeight: 140 }} key={d.h}><h3 style={{ marginTop: 0 }}>{d.h}</h3><p>{d.d}</p></div>))}
          </div>
        </div>
      </section>

      <section className="blk">
        <div className="wrap">
          <SecHead num="/ 03" title={dataLabel} sub="Straight from your account, day by day. No manual exports, no spreadsheets." />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {dataPoints.map((p) => (<span key={p} className="chip rv">{p}</span>))}
          </div>
        </div>
      </section>

      <section className="blk">
        <div className="wrap">
          <SecHead num="/ 04" title="Read-only, and safe by design." />
          <div className="three" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            {safe.map((r) => (<div className="c rv" style={{ minHeight: 120 }} key={r.k}><div className="v">{r.k}</div><p>{r.v}</p></div>))}
          </div>
        </div>
      </section>

      <section className="close">
        <div className="wrap">
          <div className="lab" style={{ marginBottom: 18 }}>Private access</div>
          <h2>{ctaH}</h2>
          <p>{ctaP}</p>
          <div className="ctas" style={{ justifyContent: "center" }}><a className="btn solid" href="/book-demo">Book a demo</a></div>
        </div>
      </section>
    </ThemeShell>
  );
}
