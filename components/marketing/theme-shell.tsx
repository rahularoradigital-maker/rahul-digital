"use client";

// Shared marketing theme shell (light technical theme). Wrap any marketing page's sections in <ThemeShell>
// to get the fonts, tokens, blueprint grid, HUD header, footer, and smooth-scroll + scroll-reveal motion.
// One source of truth for the theme so a tweak propagates to every page. Hero-specific effects (particle
// field, pinned gallery) live in the pages that need them (e.g. the homepage), added as their own effect.
import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Montserrat, JetBrains_Mono } from "next/font/google";

const mont = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--f-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono" });

export const ACCENT = "#2f7d5f";

// Section heading with a scroll-in reveal, reusable across pages.
export function SecHead({ num, title, sub }: { num: string; title: string; sub?: string }) {
  return (
    <div className="sh">
      <span className="num">{num}</span>
      <div className="sh-body">
        <h2 className="sh-h2">{title}</h2>
        {sub ? <p className="sh-sub">{sub}</p> : null}
      </div>
    </div>
  );
}

export const THEME_CSS = `
  .rd{--bg:#f3f3f1;--bg2:#eceae6;--ink:#15150f;--muted:#6b6b63;--faint:#a2a29a;--line:rgba(20,20,10,.06);--line2:rgba(20,20,10,.16);--accent:${ACCENT};--sans:var(--f-sans),"Montserrat",system-ui,sans-serif;--mono:var(--f-mono),ui-monospace,monospace;background:var(--bg);color:var(--ink);font-family:var(--sans);min-height:100vh;letter-spacing:-.01em;-webkit-font-smoothing:antialiased;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:72px 72px;background-position:-1px -1px;}
  .rd *{box-sizing:border-box;}
  .rd .mono{font-family:var(--mono);}
  .rd .lab{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);}
  .rd a{color:inherit;text-decoration:none;}
  .rd .wrap{max-width:1200px;margin:0 auto;padding-inline:28px;}
  .rd .rv{opacity:0;transform:translateY(20px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1);}
  .rd .rv.in{opacity:1;transform:none;}
  @media(prefers-reduced-motion:reduce){.rd .rv{opacity:1;transform:none;transition:none;}}
  html.lenis,html.lenis body{height:auto;}
  .lenis.lenis-smooth{scroll-behavior:auto!important;}
  .lenis.lenis-stopped{overflow:hidden;}
  .rd .hud{position:fixed;top:0;left:0;right:0;z-index:30;display:flex;align-items:center;justify-content:space-between;padding:18px 28px;border-bottom:1px solid var(--line);background:linear-gradient(#f3f3f1f2,#f3f3f199 70%,transparent);backdrop-filter:blur(6px);}
  .rd .brand{display:flex;align-items:center;gap:10px;font-weight:600;letter-spacing:.02em;font-size:15px;}
  .rd .brand b{color:var(--accent);}
  .rd .brand .g{width:22px;height:22px;border:1px solid var(--line2);display:grid;place-items:center;font-family:var(--mono);font-size:12px;color:var(--accent);}
  .rd .hud nav{display:flex;gap:26px;}
  .rd .hud nav a{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);transition:color .2s;}
  .rd .hud nav a:hover{color:var(--ink);}
  .rd .stat{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);display:flex;gap:8px;align-items:center;}
  .rd .dot{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent);animation:pulse 2.4s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  @media(max-width:760px){.rd .hud nav{display:none;}}
  .rd .btn{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;padding:14px 26px;border:1px solid var(--line2);color:var(--ink);background:transparent;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:10px;}
  .rd .btn:hover{border-color:var(--accent);color:var(--accent);transform:translateY(-1px);}
  .rd .btn.solid{background:var(--accent);color:#fff;border-color:var(--accent);}
  .rd .btn.solid:hover{background:#276a51;border-color:#276a51;}
  .rd .ctas{display:flex;gap:14px;flex-wrap:wrap;}
  .rd .page-hero{position:relative;padding:150px 0 60px;border-bottom:1px solid var(--line);}
  .rd .page-hero .eyebrow{display:inline-flex;align-items:center;gap:12px;margin-bottom:24px;}
  .rd .page-hero .eyebrow .tick{width:28px;height:1px;background:var(--line2);}
  .rd .page-hero h1{font-size:clamp(2.2rem,5vw,4rem);font-weight:600;letter-spacing:-.03em;line-height:1.03;margin:0 0 20px;max-width:16ch;text-wrap:balance;}
  .rd .page-hero p.lede{font-size:clamp(1rem,1.6vw,1.25rem);color:var(--muted);max-width:60ch;line-height:1.6;margin:0 0 30px;}
  .rd section.blk{position:relative;padding:100px 0;border-top:1px solid var(--line);}
  .rd .sh{display:flex;align-items:baseline;gap:16px;margin-bottom:48px;flex-wrap:wrap;}
  .rd .sh .num{font-family:var(--mono);font-size:12px;color:var(--accent);letter-spacing:.1em;}
  .rd .sh-body{flex:1;min-width:280px;}
  .rd .sh-h2{font-size:clamp(1.7rem,3.4vw,2.6rem);font-weight:600;letter-spacing:-.02em;margin:0;line-height:1.06;text-wrap:balance;}
  .rd .sh-sub{color:var(--muted);font-size:15px;line-height:1.5;margin:10px 0 0;max-width:56ch;}
  .rd .three{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);}
  .rd .c{background:var(--bg);padding:34px 28px;min-height:200px;display:flex;flex-direction:column;}
  .rd .c .v{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;display:flex;align-items:center;gap:10px;margin-bottom:16px;color:var(--accent);}
  .rd .c .st{width:26px;height:3px;}
  .rd .c h3{font-size:1.25rem;font-weight:600;margin:0 0 10px;}
  .rd .c p{color:var(--muted);font-size:14.5px;margin:0;}
  .rd .c .meta{margin-top:auto;padding-top:18px;font-family:var(--mono);font-size:11.5px;color:var(--faint);}
  @media(max-width:820px){.rd .three{grid-template-columns:1fr!important;}}
  .rd .chip{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line2);padding:10px 16px;transition:.2s;}
  .rd .chip:hover{border-color:var(--accent);color:var(--accent);}
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
  .rd .close{text-align:center;padding:120px 0;border-top:1px solid var(--line);}
  .rd .close h2{font-size:clamp(2rem,5vw,3.2rem);font-weight:600;letter-spacing:-.03em;margin:0 0 16px;text-wrap:balance;}
  .rd .close p{color:var(--muted);max-width:48ch;margin:0 auto 28px;}
  .rd footer{border-top:1px solid var(--line);padding:34px 0;}
  .rd .foot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);}
  .rd .foot a:hover{color:var(--ink);}
`;

export function ThemeShell({ children, active }: { children: ReactNode; active?: string }) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    if (reduce) lenis.stop();

    const io = new IntersectionObserver(
      (ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.14 },
    );
    document.querySelectorAll<HTMLElement>(".rd .rv").forEach((el) => io.observe(el));

    const ctx = gsap.context(() => {
      if (reduce) return;
      gsap.utils.toArray<HTMLElement>(".rd .sh-body").forEach((el) => {
        gsap.fromTo(el, { y: 30 }, { y: -18, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });
    });
    return () => { ctx.revert(); io.disconnect(); lenis.destroy(); gsap.ticker.remove(raf); };
  }, []);

  const nav = [
    ["/product", "Product"],
    ["/pricing", "Pricing"],
    ["/blog", "Blog"],
    ["/book-demo", "Book demo"],
  ];
  return (
    <div className={`${mont.variable} ${mono.variable} rd`}>
      <style>{THEME_CSS}</style>
      <header className="hud">
        <a className="brand" href="/"><span className="g">A</span> Ad<b>Scale</b></a>
        <nav>{nav.map(([h, t]) => (<a key={h} href={h} style={active === h ? { color: "var(--ink)" } : undefined}>{t}</a>))}</nav>
        <div className="stat"><span className="dot" /> Private beta</div>
      </header>
      <main>{children}</main>
      <footer><div className="wrap foot"><span>AdScale &middot; Creative decision intelligence</span><span>Meta + Google &middot; Read-only &middot; Draft-only</span></div></footer>
    </div>
  );
}
