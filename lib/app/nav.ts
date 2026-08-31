// Single source of truth for the app's left-menu structure and page titles.
// Consolidated to 6 items: gated/creative features live as tabs inside a parent
// page (Creative, Media, Market) rather than as separate menu entries.

export type NavItem = { label: string; icon: string; href: string };

export const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Decide",
    items: [
      { label: "Cockpit", icon: "▦", href: "/app" },
      { label: "Actions", icon: "◎", href: "/app/action-center" },
    ],
  },
  {
    group: "Analyze",
    items: [
      { label: "Creative", icon: "◔", href: "/app/creative" },
      { label: "Studio", icon: "✎", href: "/app/creative-production" },
      { label: "Funnel", icon: "⧗", href: "/app/funnel" },
      { label: "Media", icon: "▲", href: "/app/media" },
      { label: "Change Impact", icon: "⇄", href: "/app/changes" },
      { label: "Reconcile", icon: "=", href: "/app/reconcile" },
      { label: "Market", icon: "⚑", href: "/app/market" },
      { label: "Influencer Hunt", icon: "◇", href: "/app/influencer" },
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
