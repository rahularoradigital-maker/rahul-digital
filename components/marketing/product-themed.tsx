"use client";

// Themed /product content in the shared marketing theme. AdScale's own content; the page's metadata +
// JSON-LD stay in app/product/page.tsx (server).
import { ThemeShell, SecHead } from "@/components/marketing/theme-shell";

export default function ProductThemed() {
  return (
    <ThemeShell active="/product">
      <section className="page-hero">
        <div className="wrap">
          <div className="eyebrow"><span className="tick" /><span className="lab">The platform</span></div>
          <h1>The platform behind every scale, refresh, and kill.</h1>
          <p className="lede">AdScale connects to your Meta and Google ad accounts and hands your team a ranked, reasoned decision on what to scale, refresh, or kill, with the why behind every call. It never touches your account.</p>
          <div className="ctas"><a className="btn solid" href="/book-demo">Request access</a><a className="btn" href="/pricing">See pricing</a></div>
        </div>
      </section>

      <section className="blk">
        <div className="wrap">
          <SecHead num="/ 01" title="Three verdicts. One reason each." sub="Every ad is judged on its own objective and its own history, never a universal benchmark." />
          <div className="three">
            <div className="c rv"><div className="v" style={{ color: "#2f7d5f" }}><span className="st" style={{ background: "#2f7d5f" }} />Scale</div><h3>Push the winners</h3><p>A proven ad, out of learning and holding above target. Scale in steps that do not reset delivery.</p><div className="meta">gate: sufficiency · materiality · ROAS</div></div>
            <div className="c rv"><div className="v" style={{ color: "#b45309" }}><span className="st" style={{ background: "#b45309" }} />Refresh</div><h3>Catch fatigue early</h3><p>Frequency climbing, CTR sliding, CPM creeping, together, against the ad's own baseline.</p><div className="meta">signal: leading indicators, day-wise</div></div>
            <div className="c rv"><div className="v" style={{ color: "#b91c1c" }}><span className="st" style={{ background: "#b91c1c" }} />Kill</div><h3>Stop the bleed</h3><p>Judgeable, clearly below target across a rolling window, failing inside a healthy ad set.</p><div className="meta">never on noise · never mid-learning</div></div>
          </div>
        </div>
      </section>

      <section className="blk">
        <div className="wrap">
          <SecHead num="/ 02" title="What it reads." sub="Buyer-grade signals, not a wall of raw metrics. Each one maps to a decision." />
          <div className="three" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            {[["Fatigue", "Creative fatigue, early", "Frequency, CTR and CPM moving together against each ad's own history."], ["Funnel", "The exact leaking step", "Thumb-stop, hold, click, landing, cart, checkout, read as a chain."], ["ROAS / MER", "Numbers you can trust", "Platform ROAS reconciled against real store totals, not a self-report."], ["Rank", "Why Google will not show you", "Impression share split into budget-capped versus rank-capped."]].map(([k, h, p]) => (
              <div className="c rv" style={{ minHeight: 150 }} key={h}><div className="v">{k}</div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="blk">
        <div className="wrap">
          <SecHead num="/ 03" title="The weekly loop." sub="AI decides what to look at. Deterministic rules decide what is true. You decide what happens." />
          <div className="three" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {[["01 / Read", "Connect", "Read-only access to Meta and Google, every spending ad, day by day."], ["02 / Diagnose", "Trace", "Walk the funnel as a chain of ratios and find the first step that leaks."], ["03 / Decide", "Rank", "Scale, refresh, or kill, ranked by money at stake."], ["04 / Approve", "Hand off", "Every call is a draft. You approve it and apply it in Ads Manager."]].map(([n, h, p]) => (
              <div className="c rv" style={{ minHeight: 170 }} key={h}><div className="v">{n}</div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="blk">
        <div className="wrap">
          <SecHead num="/ 04" title="Connects to where you spend." sub="Read-only, official APIs, encrypted tokens. It never spends, pauses, or edits." />
          <div className="three" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            <a className="c rv" href="/integrations/meta"><div className="v">Meta</div><h3>Facebook &amp; Instagram &rarr;</h3><p>Day-wise per-ad performance, creative fatigue, and the funnel read across every connected account.</p></a>
            <a className="c rv" href="/integrations/google-ads"><div className="v">Google</div><h3>Google Ads &rarr;</h3><p>Impression share, budget-vs-rank, Quality Score triage, and the right north-star per campaign type.</p></a>
          </div>
        </div>
      </section>

      <section className="close">
        <div className="wrap">
          <div className="lab" style={{ marginBottom: 18 }}>Private beta, by approval</div>
          <h2>Know what to change. And why.</h2>
          <p>Request access and we will review your account. New sign-ups join the waitlist until approved.</p>
          <div className="ctas" style={{ justifyContent: "center" }}><a className="btn solid" href="/book-demo">Request access</a></div>
        </div>
      </section>
    </ThemeShell>
  );
}
