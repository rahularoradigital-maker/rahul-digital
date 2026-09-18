"use client";

// STAGED redesign preview (not the live site) at /preview/home. AdScale's own content in a light,
// technical visual language (Montserrat, blueprint grid, mono micro-labels, viewfinder + scroll motion).
// Motion is applied throughout via React Bits components already installed in components/ (True Focus,
// SplitText, ScrollReveal, ShinyText, Particles) - owned, MIT-licensed animation, matched to the reference's
// feel. Colours + spacing match the reference; all copy, product and imagery are AdScale's.
import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import TrueFocus from "@/components/TrueFocus";
import Particles from "@/components/Particles";
import SplitText from "@/components/SplitText";
import ScrollReveal from "@/components/ScrollReveal";
import ShinyText from "@/components/ShinyText";

const mont = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--f-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono" });

const ACCENT = "#2f7d5f";

const FAQS: { q: string; a: string }[] = [
  { q: "What does AdScale do?", a: "AdScale reads your Meta and Google ad accounts and tells you what to scale, refresh, or kill, with a clear reason for every call. It turns raw ad metrics into a decision you can act on." },
  { q: "How is AdScale different from Meta Ads Manager?", a: "Ads Manager shows you the numbers. AdScale reads those numbers and gives you the decision plus the reason. It first checks whether there is enough spend behind a metric to trust it, so you do not act on a lucky or unlucky day." },
  { q: "Does AdScale change my ads automatically?", a: "No. AdScale recommends; you decide and act. It never edits, pauses, or spends on your account by itself." },
  { q: "Which ad platforms does AdScale support?", a: "Meta (Facebook and Instagram) and Google Ads. You can view decisions for one platform or both together." },
  { q: "How does AdScale decide what to scale or kill?", a: "It checks three things in order: is there enough spend to judge the metric at all, what is the trend over a real window, and how the ad stands against your own other ads on the same objective. A single good or bad day is never enough on its own." },
  { q: "Will AdScale recommend acting on a paused or ended campaign?", a: "No. AdScale never points you to anything paused or ended as a next action. It can, however, tell you when a paused or ended campaign was the cause of a recent drop in performance." },
  { q: "Is my ad account data safe?", a: "AdScale connects through the official Meta and Google APIs and reads your data only to analyse it. It does not post, edit, or change anything on your account." },
  { q: "Does AdScale work for agencies with multiple accounts?", a: "Yes. AdScale works across multiple ad accounts, so an agency can see the decisions for every client in one place." },
  { q: "How much does AdScale cost?", a: "AdScale is in early access. Book a demo and we will walk you through how it works and current pricing." },
];
const GUIDES = [
  { slug: "how-to-decide-what-to-change-in-meta-ads", t: "How to decide what to change in your Meta ads" },
  { slug: "good-roas-for-d2c-brand", t: "What is a good ROAS for a D2C brand?" },
  { slug: "meta-ads-vs-google-ads-where-to-start", t: "Meta Ads vs Google Ads: where to start" },
];
const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };

function SecHead({ num, title, sub }: { num: string; title: string; sub?: string }) {
  return (
    <div className="sh">
      <span className="num">{num}</span>
      <div className="sh-body">
        <SplitText text={title} className="sh-h2" delay={18} duration={0.6} splitType="chars" from={{ opacity: 0, y: 28 }} to={{ opacity: 1, y: 0 }} rootMargin="-80px" />
        {sub ? (
          <ScrollReveal baseOpacity={0.12} enableBlur blurStrength={4} baseRotation={2} containerClassName="sh-sub-wrap" textClassName="sh-sub">
            {sub}
          </ScrollReveal>
        ) : null}
      </div>
    </div>
  );
}

// Original product mockups drawn in SVG (AdScale's own screens, my own artwork) to fill the showcase
// frames - not screenshots and not copied from anywhere. Palette matches the page.
function Shot({ kind }: { kind: "cockpit" | "studio" | "funnel" | "market" }) {
  const INK = "#15150f", MUT = "#a2a29a", LINE = "#dcdad4", AC = "#2f7d5f";
  return (
    <svg className="shot" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${kind} preview`}>
      <rect width="320" height="200" fill="#eceae6" />
      {kind === "cockpit" && (
        <g>
          <circle cx="60" cy="76" r="30" fill="none" stroke={LINE} strokeWidth="7" />
          <circle cx="60" cy="76" r="30" fill="none" stroke={AC} strokeWidth="7" strokeLinecap="round" strokeDasharray="135 188" transform="rotate(-90 60 76)" />
          <text x="60" y="82" fontFamily="monospace" fontSize="17" fontWeight="700" fill={INK} textAnchor="middle">72</text>
          {[0, 1, 2].map((i) => (<g key={i}><rect x={116 + i * 66} y="48" width="56" height="46" rx="2" fill="#fff" stroke={LINE} /><rect x={124 + i * 66} y="58" width="24" height="4" rx="2" fill={MUT} /><rect x={124 + i * 66} y="72" width={30 - i * 6} height="8" rx="2" fill={i === 0 ? AC : INK} /></g>))}
          {[["#2f7d5f", "SCALE"], ["#b45309", "REFRESH"], ["#b91c1c", "KILL"]].map(([c, t], i) => (<g key={t}><circle cx="26" cy={128 + i * 22} r="4" fill={c} /><text x="38" y={132 + i * 22} fontFamily="monospace" fontSize="9" fill={INK}>{t}</text><rect x="96" y={124 + i * 22} width={180 - i * 40} height="7" rx="3" fill={c} opacity="0.22" /></g>))}
        </g>
      )}
      {kind === "studio" && (
        <g>
          {[0, 1, 2, 3, 4, 5].map((i) => { const x = 22 + (i % 3) * 96, y = 26 + Math.floor(i / 3) * 70; const on = i === 0 || i === 4; return (<g key={i}><rect x={x} y={y} width="84" height="58" rx="3" fill={on ? "#dfeee7" : "#fff"} stroke={on ? AC : LINE} /><rect x={x + 10} y={y + 12} width="44" height="6" rx="3" fill={on ? AC : MUT} /><rect x={x + 10} y={y + 26} width="60" height="4" rx="2" fill={LINE} /><rect x={x + 10} y={y + 36} width="40" height="4" rx="2" fill={LINE} /></g>); })}
          <rect x="90" y="176" width="140" height="16" rx="8" fill={AC} /><text x="160" y="187" fontFamily="monospace" fontSize="9" fill="#fff" textAnchor="middle">GENERATE</text>
        </g>
      )}
      {kind === "funnel" && (
        <g>
          {[[260, "Impressions"], [210, "Clicks"], [150, "Landing"], [96, "Add to cart"], [58, "Purchase"]].map(([w, t], i) => { const leak = i === 2; return (<g key={t}><rect x={(320 - (w as number)) / 2} y={30 + i * 30} width={w as number} height="18" rx="2" fill={leak ? "none" : INK} opacity={leak ? 1 : 0.82} stroke={leak ? "#b91c1c" : "none"} strokeWidth="2" strokeDasharray={leak ? "5 4" : "0"} /><text x="10" y={43 + i * 30} fontFamily="monospace" fontSize="8" fill={leak ? "#b91c1c" : MUT}>{t}</text></g>); })}
          <text x="256" y="105" fontFamily="monospace" fontSize="8" fill="#b91c1c">leak</text>
        </g>
      )}
      {kind === "market" && (
        <g>
          {[[210, true], [150, false], [176, false], [120, false]].map(([w, hi], i) => (<g key={i}><rect x="20" y={30 + i * 38} width="70" height="24" rx="2" fill="#fff" stroke={LINE} /><circle cx="32" cy={42 + i * 38} r="5" fill={hi ? AC : MUT} /><rect x="42" y={39 + i * 38} width="36" height="6" rx="3" fill={MUT} /><rect x="104" y={38 + i * 38} width={w as number} height="8" rx="4" fill={hi ? AC : INK} opacity={hi ? 1 : 0.35} /></g>))}
        </g>
      )}
    </svg>
  );
}

export default function HomeRedesign() {
  // Scroll-reveal every card/frame/step so motion runs through the whole page (not just the hero).
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.registerPlugin(ScrollTrigger);

    // 1) Smooth momentum scrolling (Lenis), synced to ScrollTrigger so all scroll animations stay aligned.
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    if (reduce) lenis.stop();

    // Scroll-reveal for cards/frames/steps.
    const io = new IntersectionObserver(
      (ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.14 },
    );
    document.querySelectorAll<HTMLElement>(".rd .rv").forEach((el) => io.observe(el));

    const ctx = gsap.context(() => {
      if (reduce) return;
      // 2) Scroll-driven parallax: particles drift slower, hero content lifts + fades as you leave the hero.
      gsap.to(".rd .pfield", { yPercent: 24, ease: "none", scrollTrigger: { trigger: ".rd .hero", start: "top top", end: "bottom top", scrub: true } });
      gsap.to(".rd .hero-in", { yPercent: 16, opacity: 0.25, ease: "none", scrollTrigger: { trigger: ".rd .hero", start: "top top", end: "bottom top", scrub: true } });
      // headings drift at their own pace as sections pass
      gsap.utils.toArray<HTMLElement>(".rd .sh-body").forEach((el) => {
        gsap.fromTo(el, { y: 34 }, { y: -22, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });
      // 3+4) Pinned, horizontal product gallery: the work section sticks and scrolls sideways, then releases.
      const track = document.querySelector<HTMLElement>(".rd .work-track");
      const pin = document.querySelector<HTMLElement>(".rd .work-pin");
      if (track && pin && track.scrollWidth > window.innerWidth) {
        const dist = track.scrollWidth - pin.clientWidth;
        gsap.to(track, { x: -dist, ease: "none", scrollTrigger: { trigger: pin, start: "top top", end: () => `+=${dist}`, scrub: 0.6, pin: true, anticipatePin: 1, invalidateOnRefresh: true } });
      }
    });

    return () => { ctx.revert(); io.disconnect(); lenis.destroy(); gsap.ticker.remove(raf); };
  }, []);

  return (
    <div className={`${mont.variable} ${mono.variable} rd`}>
      <style>{`
        .rd {
          --bg:#f3f3f1; --bg2:#eceae6; --ink:#15150f; --muted:#6b6b63; --faint:#a2a29a;
          --line:rgba(20,20,10,.06); --line2:rgba(20,20,10,.16); --accent:${ACCENT};
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

        /* scroll-reveal for cards/frames/steps */
        .rd .rv{opacity:0;transform:translateY(20px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1);}
        .rd .rv.in{opacity:1;transform:none;}
        @media(prefers-reduced-motion:reduce){.rd .rv{opacity:1;transform:none;transition:none;}}

        .rd .hud{position:fixed;top:0;left:0;right:0;z-index:30;display:flex;align-items:center;justify-content:space-between;
          padding:18px 28px;border-bottom:1px solid var(--line);background:linear-gradient(#f3f3f1f2,#f3f3f199 70%,transparent);backdrop-filter:blur(6px);}
        .rd .brand{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:.02em;font-size:15px;}
        .rd .brand b{color:var(--accent);}
        .rd .brand .g{width:22px;height:22px;border:1px solid var(--line2);display:grid;place-items:center;font-family:var(--mono);font-size:12px;color:var(--accent);}
        .rd nav{display:flex;gap:28px;}
        .rd nav a{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);transition:color .2s;}
        .rd nav a:hover{color:var(--ink);}
        .rd .stat{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);display:flex;gap:8px;align-items:center;}
        .rd .dot{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent);animation:pulse 2.4s ease-in-out infinite;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
        @media(max-width:760px){.rd nav{display:none;}}

        .rd .hero{position:relative;min-height:100vh;display:grid;place-items:center;overflow:hidden;}
        .rd .pfield{position:absolute;inset:0;z-index:0;opacity:.9;}
        .rd .corners{position:absolute;inset:0;z-index:1;pointer-events:none;}
        .rd .corner{position:absolute;display:flex;gap:10px;max-width:210px;animation:fadeIn 1.2s ease both;}
        .rd .corner .n{font-family:var(--mono);font-size:11px;color:var(--accent);letter-spacing:.1em;}
        .rd .corner .t{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);line-height:1.5;}
        .rd .corner.tl{top:104px;left:30px;animation-delay:.3s;} .rd .corner.tr{top:104px;right:30px;flex-direction:row-reverse;text-align:right;animation-delay:.45s;}
        .rd .corner.bl{bottom:44px;left:30px;animation-delay:.6s;} .rd .corner.br{bottom:44px;right:30px;flex-direction:row-reverse;text-align:right;animation-delay:.75s;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @media(max-width:900px){.rd .corner{display:none;}}

        .rd .hero-in{position:relative;z-index:2;text-align:center;padding:120px 24px 60px;max-width:1000px;}
        .rd .eyebrow{display:inline-flex;align-items:center;gap:12px;margin-bottom:30px;}
        .rd .eyebrow .tick{width:28px;height:1px;background:var(--line2);}
        .rd .focuswrap{margin:0 auto 26px;}
        .rd .sub{font-size:clamp(1rem,1.5vw,1.2rem);color:var(--muted);max-width:58ch;margin:0 auto 36px;line-height:1.65;}
        .rd .ctas{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
        .rd .btn{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;padding:14px 26px;border:1px solid var(--line2);color:var(--ink);background:transparent;cursor:pointer;transition:all .2s;}
        .rd .btn:hover{border-color:var(--accent);color:var(--accent);transform:translateY(-1px);}
        .rd .btn.solid{background:var(--accent);color:#fff;border-color:var(--accent);}
        .rd .btn.solid:hover{background:#276a51;border-color:#276a51;}

        .rd section.blk{position:relative;padding:110px 0;border-top:1px solid var(--line);}
        .rd .sh{display:flex;align-items:baseline;gap:16px;margin-bottom:50px;flex-wrap:wrap;}
        .rd .sh .num{font-family:var(--mono);font-size:12px;color:var(--accent);letter-spacing:.1em;}
        .rd .sh-body{flex:1;min-width:280px;}
        .rd .sh-h2{font-size:clamp(1.7rem,3.4vw,2.7rem);font-weight:600;letter-spacing:-.02em;margin:0;display:block;line-height:1.05;}
        .rd .sh-sub-wrap{margin:10px 0 0;}
        .rd .sh-sub{color:var(--muted);font-size:15px;font-weight:400;line-height:1.5;}
        .rd .sh-sub *{font-size:15px!important;}
        .rd .three{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);}
        .rd .c{background:var(--bg);padding:36px 30px;min-height:230px;display:flex;flex-direction:column;}
        .rd .c .v{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;display:flex;align-items:center;gap:10px;margin-bottom:18px;}
        .rd .c .st{width:26px;height:3px;}
        .rd .c h3{font-size:1.3rem;font-weight:600;margin:0 0 10px;}
        .rd .c p{color:var(--muted);font-size:14.5px;margin:0;}
        .rd .c .meta{margin-top:auto;padding-top:20px;font-family:var(--mono);font-size:11.5px;color:var(--faint);}
        .rd .v.accent2{color:var(--accent);}
        .rd .chip{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line2);padding:10px 16px;transition:.2s;}
        .rd .chip.in:hover{border-color:var(--accent);color:var(--accent);}
        @media(max-width:820px){.rd .three{grid-template-columns:1fr!important;}}

        .rd .work{display:grid;grid-template-columns:repeat(2,1fr);gap:28px;}
        @media(max-width:820px){.rd .work{grid-template-columns:1fr;}}
        .rd .win{border:1px solid var(--line2);background:var(--bg2);overflow:hidden;transition:transform .3s,box-shadow .3s;}
        .rd .win.in:hover{transform:translateY(-4px);box-shadow:0 18px 50px rgba(20,20,10,.10);}
        .rd .win .bar{display:flex;align-items:center;gap:7px;padding:11px 14px;border-bottom:1px solid var(--line);background:var(--bg);}
        .rd .win .bar i{width:9px;height:9px;border-radius:50%;background:var(--line2);display:inline-block;}
        .rd .win .shot{aspect-ratio:16/10;width:100%;border:0;display:block;background:var(--bg2);}
        .rd .win .ph{aspect-ratio:16/10;display:grid;place-items:center;text-align:center;padding:24px;color:var(--faint);font-family:var(--mono);font-size:12px;letter-spacing:.06em;}
        .rd .win .cap{display:flex;justify-content:space-between;gap:12px;padding:16px 18px;border-top:1px solid var(--line);}
        .rd .win .cap h4{margin:0;font-size:1rem;font-weight:600;}
        .rd .win .cap span{font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;}

        /* Lenis smooth scroll */
        html.lenis,html.lenis body{height:auto;}
        .lenis.lenis-smooth{scroll-behavior:auto!important;}
        .lenis.lenis-smooth [data-lenis-prevent]{overscroll-behavior:contain;}
        .lenis.lenis-stopped{overflow:hidden;}
        /* pinned horizontal product gallery */
        .rd .work-pin{overflow:hidden;padding-inline:28px;}
        .rd .work-track{display:flex;gap:28px;width:max-content;}
        .rd .work-track .win{flex:0 0 min(78vw,540px);}
        @media(prefers-reduced-motion:reduce){.rd .work-pin{overflow-x:auto;}}
        .rd .marq{overflow:hidden;border-block:1px solid var(--line);padding:22px 0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);}
        .rd .marq .track{display:flex;gap:56px;width:max-content;animation:marq 26s linear infinite;}
        @media(prefers-reduced-motion:reduce){.rd .marq .track{animation:none;}}
        @keyframes marq{to{transform:translateX(-50%);}}
        .rd .marq span{font-family:var(--mono);font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);white-space:nowrap;}

        .rd .about{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:start;}
        @media(max-width:820px){.rd .about{grid-template-columns:1fr;}}
        .rd .about .lead{font-size:clamp(1.1rem,2vw,1.5rem);line-height:1.5;font-weight:500;}
        .rd .about .lead *{font-size:inherit!important;}
        .rd .form{display:flex;flex-direction:column;gap:14px;border:1px solid var(--line2);padding:26px;background:var(--bg2);}
        .rd .form label{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);}
        .rd .form input{width:100%;background:var(--bg);border:1px solid var(--line2);padding:13px 14px;font-family:var(--sans);font-size:15px;color:var(--ink);}
        .rd .form input:focus{outline:2px solid var(--accent);outline-offset:1px;}

        .rd .faq{display:flex;flex-direction:column;border-top:1px solid var(--line);}
        .rd .qa{border-bottom:1px solid var(--line);}
        .rd .qa summary{cursor:pointer;list-style:none;padding:22px 4px;font-size:1.08rem;font-weight:600;display:flex;justify-content:space-between;gap:16px;align-items:center;}
        .rd .qa summary::-webkit-details-marker{display:none;}
        .rd .qa summary::after{content:"+";font-family:var(--mono);color:var(--accent);font-weight:400;font-size:1.2rem;}
        .rd .qa[open] summary::after{content:"\\2013";}
        .rd .qa p{margin:0 4px 24px;color:var(--muted);font-size:15px;max-width:74ch;line-height:1.6;}
        .rd .guides{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);}
        @media(max-width:820px){.rd .guides{grid-template-columns:1fr 1fr;}}
        .rd .guide{background:var(--bg);padding:26px 22px;min-height:150px;display:flex;flex-direction:column;gap:12px;transition:.2s;}
        .rd .guide:hover{background:var(--bg2);}
        .rd .guide .k{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);}
        .rd .guide h4{margin:auto 0 0;font-size:1.02rem;font-weight:600;line-height:1.3;}
        .rd footer{border-top:1px solid var(--line);padding:30px 0;}
        .rd .foot{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);}
      `}</style>

      <header className="hud">
        <div className="brand"><span className="g">A</span> Ad<b>Scale</b></div>
        <nav><a href="#work">Product</a><a href="#how">Method</a><a href="#faq">FAQ</a><a href="/blog">Blog</a><a href="#access">Access</a></nav>
        <div className="stat"><span className="dot" /> Private beta</div>
      </header>

      <section className="hero">
        <div className="pfield">
          <Particles particleColors={["#15150f", ACCENT]} particleCount={220} particleSpread={11} speed={0.08} particleBaseSize={70} moveParticlesOnHover alphaParticles disableRotation={false} />
        </div>
        <div className="corners" aria-hidden="true">
          <div className="corner tl"><span className="n">01</span><span className="t">Creative decision intelligence</span></div>
          <div className="corner tr"><span className="n">02</span><span className="t">Meta + Google ads</span></div>
          <div className="corner bl"><span className="n">03</span><span className="t">Read-only, safe by design</span></div>
          <div className="corner br"><span className="n">04</span><span className="t">You approve every change</span></div>
        </div>
        <div className="hero-in">
          <div className="eyebrow"><span className="tick" /><ShinyText text="Decision intelligence for performance marketing" className="lab" speed={4} /></div>
          <div className="focuswrap">
            <TrueFocus sentence="Know what to change" borderColor={ACCENT} glowColor="rgba(47,125,95,0.5)" blurAmount={4} animationDuration={0.5} pauseBetweenAnimations={0.9} />
            <div style={{ marginTop: 8 }}>
              <TrueFocus sentence="in your ads" borderColor={ACCENT} glowColor="rgba(47,125,95,0.5)" blurAmount={4} animationDuration={0.5} pauseBetweenAnimations={0.9} />
            </div>
          </div>
          <p className="sub">AdScale reads your Meta and Google ad accounts day by day and tells you what to scale, refresh, or kill, with a reason behind every call. It never touches your account. Every move is a draft you approve.</p>
          <div className="ctas"><a className="btn solid" href="#access">Request access</a><a className="btn" href="#how">See the method</a></div>
        </div>
      </section>

      <section className="blk" id="work">
        <div className="wrap">
          <SecHead num="/ 01" title="Inside the product." sub="The screens where the decisions actually happen. Real account data, day-wise, with a reason on every card. Scroll to move through them." />
        </div>
        <div className="work-pin">
          <div className="work-track">
            <div className="win rv">
              <div className="bar"><i /><i /><i /><span style={{ marginLeft: 12, fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>adscaledigital.co/app</span></div>
              <Shot kind="cockpit" />
              <div className="cap"><h4>The Cockpit</h4><span>Scale · Refresh · Kill</span></div>
            </div>
            {([["adscaledigital.co/app/creative-production", "Creative Studio", "Shopify → AI static ads", "studio"], ["adscaledigital.co/app/funnel", "Funnel Diagnosis", "Find the leaking step", "funnel"], ["adscaledigital.co/app/market", "Market", "Competitor creative intel", "market"]] as const).map(([u, h, s, kind]) => (
              <div className="win rv" key={h}>
                <div className="bar"><i /><i /><i /><span style={{ marginLeft: 12, fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>{u}</span></div>
                <Shot kind={kind} />
                <div className="cap"><h4>{h}</h4><span>{s}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="marq" aria-hidden="true">
        <div className="track">{["Meta Ads", "Google Ads", "Shopify", "Instagram", "Read-only", "Day-wise", "Draft-only", "Meta Ads", "Google Ads", "Shopify", "Instagram", "Read-only", "Day-wise", "Draft-only"].map((s, i) => (<span key={i}>{s}</span>))}</div>
      </div>

      <section className="blk" id="engine">
        <div className="wrap">
          <SecHead num="/ 02" title="Three verdicts. One reason each." sub="Every ad is judged on its own objective and its own history, never a universal benchmark. The verdict comes with the number behind it." />
          <div className="three">
            <div className="c rv"><div className="v" style={{ color: "#2f7d5f" }}><span className="st" style={{ background: "#2f7d5f" }} />Scale</div><h3>Push the winners, safely</h3><p>A proven ad, out of learning and holding above target. Scale in steps that do not reset delivery.</p><div className="meta">gate: sufficiency · materiality · ROAS</div></div>
            <div className="c rv"><div className="v" style={{ color: "#b45309" }}><span className="st" style={{ background: "#b45309" }} />Refresh</div><h3>Catch fatigue before it costs</h3><p>Frequency climbing, CTR sliding, CPM creeping, together, against the ad's own baseline.</p><div className="meta">signal: leading indicators, day-wise</div></div>
            <div className="c rv"><div className="v" style={{ color: "#b91c1c" }}><span className="st" style={{ background: "#b91c1c" }} />Kill</div><h3>Stop the bleed, not the learning</h3><p>Judgeable, clearly below target across a rolling window, failing inside a healthy ad set.</p><div className="meta">never on noise · never mid-learning</div></div>
          </div>
        </div>
      </section>

      <section className="blk" id="how">
        <div className="wrap">
          <SecHead num="/ 03" title="The weekly loop. Less AI, more certainty." sub="AI decides what to look at. Deterministic rules decide what is true. You decide what happens." />
          <div className="three" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            {[["01 / Read", "Connect", "Read-only access to Meta and Google. Every spending ad, day by day, no top-N cap."], ["02 / Diagnose", "Trace", "Walk the funnel as a chain of ratios. Find the first step that falls off a cliff, not just a falling ROAS."], ["03 / Decide", "Rank", "Scale, refresh, or kill, ranked by money at stake, judged against each ad's own baseline."], ["04 / Approve", "Hand off", "Every call is a draft. You approve it and open Ads Manager to apply it. AdScale never does."]].map(([n, h, p]) => (
              <div className="c rv" style={{ minHeight: 190 }} key={h}><div className="v accent2">{n}</div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="blk" id="reads">
        <div className="wrap">
          <SecHead num="/ 04" title="What it actually reads." sub="Buyer-grade signals, not a wall of raw metrics. Each one maps to a decision." />
          <div className="three" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            {[["Fatigue", "Creative fatigue, early", "Frequency, CTR and CPM moving together against each ad's own history, one to two weeks before cost per result doubles."], ["Funnel", "The exact leaking step", "Thumb-stop, hold, click, landing, cart, checkout, read as a chain, so you fix the one step that is bleeding."], ["ROAS / MER", "Numbers you can trust", "Platform ROAS reconciled against real store totals, so you judge the business, not a self-report."], ["Rank", "Why Google will not show you", "Impression share split into budget-capped versus rank-capped: two problems, opposite fixes."]].map(([code, h, p]) => (
              <div className="c rv" style={{ minHeight: 150 }} key={h}><div className="v accent2">{code}</div><h3>{h}</h3><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="blk" id="trust">
        <div className="wrap">
          <SecHead num="/ 05" title="Trustworthy by construction." sub="A decision system is only useful if you can believe it. So it refuses to guess." />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {["Read-only scope", "Encrypted tokens", "Never spends or edits", "A reason for every call", "No universal benchmarks", "Refuses when data can't be trusted"].map((t) => (<span key={t} className="chip rv">{t}</span>))}
          </div>
        </div>
      </section>

      <section className="blk" id="about">
        <div className="wrap">
          <SecHead num="/ 06" title="Built for the person spending the money." />
          <div className="about">
            <div>
              <ScrollReveal baseOpacity={0.12} enableBlur blurStrength={4} baseRotation={2} containerClassName="about-lead-wrap" textClassName="lead">
                AdScale is decision intelligence for Meta and Google ads: it reads the account and tells you what to change, with the reasoning attached.
              </ScrollReveal>
              <ScrollReveal baseOpacity={0.12} enableBlur blurStrength={3} containerClassName="" textClassName="sh-sub">
                The principle is deliberately unfashionable: the less AI in the loop, the better. AI decides what to look at. Deterministic, buyer-grade rules decide what is actually true, so no verdict rests on noise. It connects read-only, encrypts your tokens, and never spends, pauses, or edits your account. Every recommendation is a draft you action yourself.
              </ScrollReveal>
            </div>
            <form className="form rv" onSubmit={(e) => e.preventDefault()}>
              <div className="lab">Request access</div>
              <div><label htmlFor="rq-name">Name</label><input id="rq-name" name="name" placeholder="Your name" /></div>
              <div><label htmlFor="rq-email">Work email</label><input id="rq-email" name="email" type="email" placeholder="you@brand.com" /></div>
              <div><label htmlFor="rq-acct">Ad account / brand</label><input id="rq-acct" name="account" placeholder="Brand or store URL" /></div>
              <button type="submit" className="btn solid" style={{ marginTop: 4 }}>Request access</button>
            </form>
          </div>
        </div>
      </section>

      <section className="blk" id="faq">
        <div className="wrap">
          <SecHead num="/ 07" title="Questions, answered." sub="The straight answers, before you book a demo." />
          <div className="faq">
            {FAQS.map((f, i) => (<details className="qa rv" key={i}><summary>{f.q}</summary><p>{f.a}</p></details>))}
          </div>
          <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
        </div>
      </section>

      <section className="blk" id="guides">
        <div className="wrap">
          <SecHead num="/ 08" title="Guides for media buyers." sub="Practical, no-hype reads on deciding what to change in your ads." />
          <div className="guides">
            {GUIDES.map((g) => (<a className="guide rv" href={`/blog/${g.slug}`} key={g.slug}><span className="k">Guide</span><h4>{g.t}</h4></a>))}
            <a className="guide rv" href="/blog"><span className="k">Index</span><h4>All guides &rarr;</h4></a>
          </div>
        </div>
      </section>

      <section className="blk" id="access" style={{ textAlign: "center", padding: "130px 0" }}>
        <div className="wrap">
          <div className="lab" style={{ marginBottom: 20 }}>Private beta, by approval</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <SplitText text="Stop guessing what to test next." className="sh-h2" delay={16} duration={0.6} splitType="chars" from={{ opacity: 0, y: 28 }} to={{ opacity: 1, y: 0 }} rootMargin="-60px" />
          </div>
          <p className="sub" style={{ margin: "16px auto 30px" }}>Request access and we will review your account. New sign-ups join the waitlist until approved.</p>
          <div className="ctas"><a className="btn solid" href="#about">Request access</a></div>
        </div>
      </section>

      <footer><div className="wrap foot"><span>AdScale · Creative decision intelligence</span><span>Staged preview · /preview/home</span></div></footer>
    </div>
  );
}
