"use client";

// STAGED redesign preview (not the live site). AdScale's own content in a vanlent-style visual language:
// light ground, Montserrat, faint blueprint grid, HUD corners + mono micro-labels, a True Focus hero
// headline and a React Bits Particles field. Reviewed at /preview/home; ported to the real marketing
// routes once approved. Uses React Bits components already installed in components/.
import { Montserrat, JetBrains_Mono } from "next/font/google";
import TrueFocus from "@/components/TrueFocus";
import Particles from "@/components/Particles";

const mont = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--f-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono" });

export default function RedesignPreview() {
  return (
    <div className={`${mont.variable} ${mono.variable} rd`}>
      <style>{`
        .rd {
          --bg:#f3f3f1; --bg2:#eceae6; --ink:#15150f; --muted:#6b6b63; --faint:#a2a29a;
          --line:rgba(20,20,10,.06); --line2:rgba(20,20,10,.16); --accent:#2f7d5f;
          --sans:var(--f-sans),"Montserrat",system-ui,sans-serif; --mono:var(--f-mono),ui-monospace,monospace;
          background:var(--bg); color:var(--ink); font-family:var(--sans); min-height:100vh;
          letter-spacing:-.01em; -webkit-font-smoothing:antialiased;
          background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
          background-size:72px 72px; background-position:-1px -1px;
        }
        .rd *{box-sizing:border-box;}
        .rd .mono{font-family:var(--mono);}
        .rd .lab{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);}
        .rd a{color:inherit;text-decoration:none;}
        .rd .wrap{max-width:1200px;margin:0 auto;padding-inline:28px;}

        .rd .hud{position:fixed;top:0;left:0;right:0;z-index:30;display:flex;align-items:center;justify-content:space-between;
          padding:18px 28px;border-bottom:1px solid var(--line);background:linear-gradient(#f3f3f1f2,#f3f3f199 70%,transparent);backdrop-filter:blur(6px);}
        .rd .brand{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:.02em;font-size:15px;}
        .rd .brand b{color:var(--accent);}
        .rd .brand .g{width:22px;height:22px;border:1px solid var(--line2);display:grid;place-items:center;font-family:var(--mono);font-size:12px;color:var(--accent);}
        .rd nav{display:flex;gap:28px;}
        .rd nav a{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);transition:color .2s;}
        .rd nav a:hover{color:var(--ink);}
        .rd .stat{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);display:flex;gap:8px;align-items:center;}
        .rd .dot{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent);}
        @media(max-width:760px){.rd nav{display:none;}}

        .rd .hero{position:relative;min-height:100vh;display:grid;place-items:center;overflow:hidden;}
        .rd .pfield{position:absolute;inset:0;z-index:0;opacity:.9;}
        .rd .corners{position:absolute;inset:0;z-index:1;pointer-events:none;}
        .rd .corner{position:absolute;display:flex;gap:10px;max-width:210px;}
        .rd .corner .n{font-family:var(--mono);font-size:11px;color:var(--accent);letter-spacing:.1em;}
        .rd .corner .t{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);line-height:1.5;}
        .rd .corner.tl{top:104px;left:30px;} .rd .corner.tr{top:104px;right:30px;flex-direction:row-reverse;text-align:right;}
        .rd .corner.bl{bottom:44px;left:30px;} .rd .corner.br{bottom:44px;right:30px;flex-direction:row-reverse;text-align:right;}
        @media(max-width:900px){.rd .corner{display:none;}}

        .rd .hero-in{position:relative;z-index:2;text-align:center;padding:120px 24px 60px;max-width:1000px;}
        .rd .eyebrow{display:inline-flex;align-items:center;gap:12px;margin-bottom:30px;}
        .rd .eyebrow .tick{width:28px;height:1px;background:var(--line2);}
        .rd .focuswrap{margin:0 auto 26px;}
        .rd .sub{font-size:clamp(1rem,1.5vw,1.2rem);color:var(--muted);max-width:58ch;margin:0 auto 36px;line-height:1.65;}
        .rd .ctas{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
        .rd .btn{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;padding:14px 26px;border:1px solid var(--line2);color:var(--ink);background:transparent;cursor:pointer;transition:all .2s;}
        .rd .btn:hover{border-color:var(--accent);color:var(--accent);}
        .rd .btn.solid{background:var(--accent);color:#fff;border-color:var(--accent);}
        .rd .btn.solid:hover{background:#276a51;border-color:#276a51;}

        .rd section.blk{position:relative;padding:110px 0;border-top:1px solid var(--line);}
        .rd .sh{display:flex;align-items:baseline;gap:16px;margin-bottom:50px;flex-wrap:wrap;}
        .rd .sh .num{font-family:var(--mono);font-size:12px;color:var(--accent);letter-spacing:.1em;}
        .rd .sh h2{font-size:clamp(1.7rem,3.4vw,2.7rem);font-weight:600;letter-spacing:-.02em;margin:0;text-wrap:balance;}
        .rd .sh p{color:var(--muted);margin:6px 0 0;max-width:54ch;font-size:15px;}
        .rd .three{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);}
        .rd .c{background:var(--bg);padding:36px 30px;min-height:230px;display:flex;flex-direction:column;}
        .rd .c .v{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;display:flex;align-items:center;gap:10px;margin-bottom:18px;}
        .rd .c .st{width:26px;height:3px;}
        .rd .c h3{font-size:1.3rem;font-weight:600;margin:0 0 10px;}
        .rd .c p{color:var(--muted);font-size:14.5px;margin:0;}
        .rd .c .meta{margin-top:auto;padding-top:20px;font-family:var(--mono);font-size:11.5px;color:var(--faint);}
        .rd .v.accent2{color:var(--accent);}
        .rd .chip{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);padding:10px 16px;}
        @media(max-width:820px){.rd .three{grid-template-columns:1fr!important;}}

        /* product showcase (like vanlent's Selected Work, with AdScale screens) */
        .rd .work{display:grid;grid-template-columns:repeat(2,1fr);gap:28px;}
        @media(max-width:820px){.rd .work{grid-template-columns:1fr;}}
        .rd .win{border:1px solid var(--line2);background:var(--bg2);overflow:hidden;}
        .rd .win .bar{display:flex;align-items:center;gap:7px;padding:11px 14px;border-bottom:1px solid var(--line);background:var(--bg);}
        .rd .win .bar i{width:9px;height:9px;border-radius:50%;background:var(--line2);display:inline-block;}
        .rd .win .bar .u{margin-left:12px;font-family:var(--mono);font-size:11px;color:var(--faint);}
        .rd .win .shot{aspect-ratio:16/10;width:100%;border:0;display:block;background:var(--bg2);}
        .rd .win .ph{aspect-ratio:16/10;display:grid;place-items:center;text-align:center;padding:24px;color:var(--faint);font-family:var(--mono);font-size:12px;letter-spacing:.06em;}
        .rd .win .cap{display:flex;justify-content:space-between;gap:12px;padding:16px 18px;border-top:1px solid var(--line);}
        .rd .win .cap h4{margin:0;font-size:1rem;font-weight:600;}
        .rd .win .cap span{font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;}
        /* integrations marquee */
        .rd .marq{overflow:hidden;border-block:1px solid var(--line);padding:22px 0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);}
        .rd .marq .track{display:flex;gap:56px;width:max-content;animation:marq 26s linear infinite;}
        @media(prefers-reduced-motion:reduce){.rd .marq .track{animation:none;}}
        @keyframes marq{to{transform:translateX(-50%);}}
        .rd .marq span{font-family:var(--mono);font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);white-space:nowrap;}
        /* about + form */
        .rd .about{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:start;}
        @media(max-width:820px){.rd .about{grid-template-columns:1fr;}}
        .rd .about p.lead{font-size:clamp(1.1rem,2vw,1.5rem);line-height:1.5;font-weight:500;margin:0 0 20px;text-wrap:balance;}
        .rd .about p{color:var(--muted);font-size:15px;line-height:1.7;margin:0 0 14px;}
        .rd .form{display:flex;flex-direction:column;gap:14px;border:1px solid var(--line);padding:26px;background:var(--bg2);}
        .rd .form label{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);}
        .rd .form input{width:100%;background:var(--bg);border:1px solid var(--line2);padding:13px 14px;font-family:var(--sans);font-size:15px;color:var(--ink);}
        .rd .form input:focus{outline:2px solid var(--accent);outline-offset:1px;}
        .rd footer{border-top:1px solid var(--line);padding:30px 0;}
        .rd .foot{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);}
      `}</style>

      <header className="hud">
        <div className="brand"><span className="g">A</span> Ad<b>Scale</b></div>
        <nav>
          <a href="#engine">Engine</a><a href="#how">Method</a><a href="#reads">Signals</a><a href="#access">Access</a>
        </nav>
        <div className="stat"><span className="dot" /> Private beta</div>
      </header>

      <section className="hero">
        <div className="pfield">
          <Particles particleColors={["#15150f", "#2f7d5f"]} particleCount={220} particleSpread={11} speed={0.08} particleBaseSize={70} moveParticlesOnHover alphaParticles disableRotation={false} />
        </div>
        <div className="corners" aria-hidden="true">
          <div className="corner tl"><span className="n">01</span><span className="t">Creative decision intelligence</span></div>
          <div className="corner tr"><span className="n">02</span><span className="t">Meta + Google ads</span></div>
          <div className="corner bl"><span className="n">03</span><span className="t">Read-only, safe by design</span></div>
          <div className="corner br"><span className="n">04</span><span className="t">You approve every change</span></div>
        </div>
        <div className="hero-in">
          <div className="eyebrow"><span className="tick" /><span className="lab">Decision intelligence for performance marketing</span></div>
          <div className="focuswrap">
            <TrueFocus sentence="Know what to change" borderColor="#2f7d5f" glowColor="rgba(47,125,95,0.5)" blurAmount={4} animationDuration={0.5} pauseBetweenAnimations={0.9} />
            <div style={{ marginTop: 8 }}>
              <TrueFocus sentence="in your ads" borderColor="#2f7d5f" glowColor="rgba(47,125,95,0.5)" blurAmount={4} animationDuration={0.5} pauseBetweenAnimations={0.9} />
            </div>
          </div>
          <p className="sub">AdScale reads your Meta and Google ad accounts day by day and tells you what to scale, refresh, or kill, with a reason behind every call. It never touches your account. Every move is a draft you approve.</p>
          <div className="ctas">
            <a className="btn solid" href="#access">Request access</a>
            <a className="btn" href="#how">See the method</a>
          </div>
        </div>
      </section>

      <section className="blk" id="work">
        <div className="wrap">
          <div className="sh"><span className="num">/ 01</span><div><h2>Inside the product.</h2><p>The screens where the decisions actually happen. Real account data, day-wise, with a reason on every card.</p></div></div>
          <div className="work">
            <div className="win">
              <div className="bar"><i /><i /><i /><span className="u">adscaledigital.co/app</span></div>
              <iframe className="shot" src="/preview/cockpit" title="AdScale Cockpit" loading="lazy" />
              <div className="cap"><h4>The Cockpit</h4><span>Scale · Refresh · Kill</span></div>
            </div>
            <div className="win">
              <div className="bar"><i /><i /><i /><span className="u">adscaledigital.co/app/creative-production</span></div>
              <div className="ph">Creative Studio<br />[ product screenshot to drop in ]</div>
              <div className="cap"><h4>Creative Studio</h4><span>Shopify → AI static ads</span></div>
            </div>
            <div className="win">
              <div className="bar"><i /><i /><i /><span className="u">adscaledigital.co/app/funnel</span></div>
              <div className="ph">Funnel Diagnosis<br />[ product screenshot to drop in ]</div>
              <div className="cap"><h4>Funnel Diagnosis</h4><span>Find the leaking step</span></div>
            </div>
            <div className="win">
              <div className="bar"><i /><i /><i /><span className="u">adscaledigital.co/app/market</span></div>
              <div className="ph">Market Intelligence<br />[ product screenshot to drop in ]</div>
              <div className="cap"><h4>Market</h4><span>Competitor creative intel</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="marq" aria-hidden="true">
        <div className="track">
          {["Meta Ads", "Google Ads", "Shopify", "Instagram", "Read-only", "Day-wise", "Draft-only", "Meta Ads", "Google Ads", "Shopify", "Instagram", "Read-only", "Day-wise", "Draft-only"].map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
      </div>

      <section className="blk" id="engine">
        <div className="wrap">
          <div className="sh"><span className="num">/ 02</span><div><h2>Three verdicts. One reason each.</h2><p>Every ad is judged on its own objective and its own history, never a universal benchmark. The verdict comes with the number behind it.</p></div></div>
          <div className="three">
            <div className="c"><div className="v" style={{ color: "#2f7d5f" }}><span className="st" style={{ background: "#2f7d5f" }} />Scale</div><h3>Push the winners, safely</h3><p>A proven ad, out of learning and holding above target. Scale in steps that do not reset delivery.</p><div className="meta">gate: sufficiency · materiality · ROAS</div></div>
            <div className="c"><div className="v" style={{ color: "#b45309" }}><span className="st" style={{ background: "#b45309" }} />Refresh</div><h3>Catch fatigue before it costs</h3><p>Frequency climbing, CTR sliding, CPM creeping, together, against the ad's own baseline.</p><div className="meta">signal: leading indicators, day-wise</div></div>
            <div className="c"><div className="v" style={{ color: "#b91c1c" }}><span className="st" style={{ background: "#b91c1c" }} />Kill</div><h3>Stop the bleed, not the learning</h3><p>Judgeable, clearly below target across a rolling window, failing inside a healthy ad set.</p><div className="meta">never on noise · never mid-learning</div></div>
          </div>
        </div>
      </section>

      <section className="blk" id="how">
        <div className="wrap">
          <div className="sh"><span className="num">/ 03</span><div><h2>The weekly loop. Less AI, more certainty.</h2><p>AI decides what to look at. Deterministic rules decide what is true. You decide what happens.</p></div></div>
          <div className="three" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            <div className="c" style={{ minHeight: 190 }}><div className="v accent2">01 / Read</div><h3>Connect</h3><p>Read-only access to Meta and Google. Every spending ad, day by day, no top-N cap.</p></div>
            <div className="c" style={{ minHeight: 190 }}><div className="v accent2">02 / Diagnose</div><h3>Trace</h3><p>Walk the funnel as a chain of ratios. Find the first step that falls off a cliff, not just a falling ROAS.</p></div>
            <div className="c" style={{ minHeight: 190 }}><div className="v accent2">03 / Decide</div><h3>Rank</h3><p>Scale, refresh, or kill, ranked by money at stake, judged against each ad's own baseline.</p></div>
            <div className="c" style={{ minHeight: 190 }}><div className="v accent2">04 / Approve</div><h3>Hand off</h3><p>Every call is a draft. You approve it and open Ads Manager to apply it. AdScale never does.</p></div>
          </div>
        </div>
      </section>

      <section className="blk" id="reads">
        <div className="wrap">
          <div className="sh"><span className="num">/ 04</span><div><h2>What it actually reads.</h2><p>Buyer-grade signals, not a wall of raw metrics. Each one maps to a decision.</p></div></div>
          <div className="three" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            <div className="c" style={{ minHeight: 150 }}><div className="v accent2">Fatigue</div><h3>Creative fatigue, early</h3><p>Frequency, CTR and CPM moving together against each ad's own history, one to two weeks before cost per result doubles.</p></div>
            <div className="c" style={{ minHeight: 150 }}><div className="v accent2">Funnel</div><h3>The exact leaking step</h3><p>Thumb-stop, hold, click, landing, cart, checkout, read as a chain, so you fix the one step that is bleeding.</p></div>
            <div className="c" style={{ minHeight: 150 }}><div className="v accent2">ROAS / MER</div><h3>Numbers you can trust</h3><p>Platform ROAS reconciled against real store totals, so you judge the business, not a self-report.</p></div>
            <div className="c" style={{ minHeight: 150 }}><div className="v accent2">Rank</div><h3>Why Google will not show you</h3><p>Impression share split into budget-capped versus rank-capped: two problems, opposite fixes.</p></div>
          </div>
        </div>
      </section>

      <section className="blk" id="trust">
        <div className="wrap">
          <div className="sh"><span className="num">/ 05</span><div><h2>Trustworthy by construction.</h2><p>A decision system is only useful if you can believe it. So it refuses to guess.</p></div></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {["Read-only scope", "Encrypted tokens", "Never spends or edits", "A reason for every call", "No universal benchmarks", "Refuses when data can't be trusted"].map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="blk" id="about">
        <div className="wrap">
          <div className="sh"><span className="num">/ 06</span><div><h2>Built for the person spending the money.</h2></div></div>
          <div className="about">
            <div>
              <p className="lead">AdScale is decision intelligence for Meta and Google ads: it reads the account and tells you what to change, with the reasoning attached.</p>
              <p>The principle is deliberately unfashionable: the less AI in the loop, the better. AI decides what to look at. Deterministic, buyer-grade rules decide what is actually true, sufficiency, materiality, fatigue, funnel and rank, so no verdict rests on noise. You approve every move.</p>
              <p>It connects read-only, encrypts your tokens, and never spends, pauses, or edits your account. Every recommendation is a draft you action in Ads Manager yourself. When the data cannot be trusted, it says so rather than guessing.</p>
            </div>
            <form className="form" onSubmit={(e) => e.preventDefault()}>
              <div className="lab">Request access</div>
              <div><label htmlFor="rq-name">Name</label><input id="rq-name" name="name" placeholder="Your name" /></div>
              <div><label htmlFor="rq-email">Work email</label><input id="rq-email" name="email" type="email" placeholder="you@brand.com" /></div>
              <div><label htmlFor="rq-acct">Ad account / brand</label><input id="rq-acct" name="account" placeholder="Brand or store URL" /></div>
              <button type="submit" className="btn solid" style={{ marginTop: 4 }}>Request access</button>
            </form>
          </div>
        </div>
      </section>

      <section className="blk" id="access" style={{ textAlign: "center", padding: "130px 0" }}>
        <div className="wrap">
          <div className="lab" style={{ marginBottom: 20 }}>Private beta, by approval</div>
          <h2 style={{ fontSize: "clamp(2rem,5vw,3.4rem)", fontWeight: 600, letterSpacing: "-.03em", margin: "0 0 16px", textWrap: "balance" }}>Stop guessing what to test next.</h2>
          <p style={{ color: "var(--muted)", maxWidth: "46ch", margin: "0 auto 30px" }}>Request access and we will review your account. New sign-ups join the waitlist until approved.</p>
          <div className="ctas"><a className="btn solid" href="#">Request access</a></div>
        </div>
      </section>

      <footer><div className="wrap foot"><span>AdScale · Creative decision intelligence</span><span>Staged preview · /preview/home</span></div></footer>
    </div>
  );
}
