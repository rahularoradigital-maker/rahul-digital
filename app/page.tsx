import HomeRedesign from "@/components/marketing/home-redesign";

// The live marketing homepage. Renders the shared redesign (light technical theme: Montserrat, blueprint
// grid, True Focus hero, smooth-scroll + parallax + pinned product gallery). Site-wide entity SEO
// (Organization / WebSite / SoftwareApplication JSON-LD) lives in app/layout.tsx and is unaffected.
export default function Home() {
  return <HomeRedesign />;
}
