import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

// SEO / IA (Phase-0 audit): /blog and /blog/[slug] rendered a bare <main> with NO site header or footer -
// the primary organic landing surface was a navigational dead end (no logo-home, no Pricing/Product nav,
// no footer legal links, no signup CTA), and internal PageRank from posts could not flow to money pages.
// Every other public page wraps itself in SiteHeader/SiteFooter; this layout gives the blog the same chrome.
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
