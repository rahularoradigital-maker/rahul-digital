// Single source of truth for the app's left-menu structure and page titles.
// Sub-features live as tabs inside a parent page (Creative, Media, Market) rather than as separate menu
// entries; the top-level destinations are grouped by job below (rendered generically by sidebar-nav +
// mobile-nav, so changing the grouping here is the only edit needed).

export type NavItem = { label: string; icon: string; href: string };

// IA (Phase-0 audit): the 11 destinations were Decide(2) / Analyze(8) / Manage(1) - eight items in one
// undifferentiated bucket diluted the core decide->act loop (Miller's Law: chunk; Law of Proximity: group
// what belongs together). Split "Analyze" into three honest groups by JOB: make creative (Create), diagnose
// what's happening (Diagnose), understand the market (Research). Order follows the Serial-Position effect -
// the daily loop (Decide) first, account admin (Manage) last. Routes are unchanged (no broken links); only
// the grouping and section labels change.
export const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Decide",
    items: [
      { label: "Cockpit", icon: "▦", href: "/app" },
      { label: "Actions", icon: "◎", href: "/app/action-center" },
    ],
  },
  {
    group: "Create",
    items: [
      { label: "Creative", icon: "◔", href: "/app/creative" },
      { label: "Studio", icon: "✎", href: "/app/creative-production" },
    ],
  },
  {
    group: "Diagnose",
    items: [
      { label: "Funnel", icon: "⧗", href: "/app/funnel" },
      { label: "Media", icon: "▲", href: "/app/media" },
      { label: "Change Impact", icon: "⇄", href: "/app/changes" },
      { label: "Reconcile", icon: "=", href: "/app/reconcile" },
    ],
  },
  {
    group: "Research",
    items: [
      { label: "Market", icon: "⚑", href: "/app/market" },
      { label: "Influencer Hunt", icon: "◇", href: "/app/creators" },
    ],
  },
  {
    group: "Manage",
    items: [{ label: "Settings", icon: "⚙", href: "/app/settings" }],
  },
];

/** Page title for the topbar, matched to the current pathname. */
export function titleFor(pathname: string): string {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (it.href === pathname) return it.label;
    }
  }
  return "Cockpit";
}
