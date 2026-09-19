import { ThemeShell } from "@/components/marketing/theme-shell";

// SEO / IA (Phase-0 audit): /blog and /blog/[slug] must not be navigational dead ends. Every public page
// now wraps itself in the shared marketing theme (ThemeShell), which provides the HUD nav (logo-home,
// Product/Pricing/Blog/Book-demo) and footer, so internal PageRank from posts flows to the money pages.
// ThemeShell also carries the light technical theme + smooth-scroll/reveal motion used site-wide.
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <ThemeShell active="/blog">{children}</ThemeShell>;
}
