// Single source of truth for the app's left-menu structure and page titles.
// Both the sidebar (highlighting the active route) and the topbar (deriving the
// page title) read from here, so a route is defined in exactly one place.

export type NavItem = { label: string; icon: string; href: string };

export const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Decide",
    items: [
      { label: "Account Cockpit", icon: "▦", href: "/app" },
      { label: "Action Center", icon: "◎", href: "/app/action-center" },
      { label: "Test Plan", icon: "✓", href: "/app/test-plan" },
    ],
  },
  {
    group: "Creative",
    items: [
      { label: "Creative Fatigue", icon: "◔", href: "/app/creative-fatigue" },
      { label: "Diversity & White Space", icon: "◈", href: "/app/diversity" },
      { label: "Brand Brain", icon: "◆", href: "/app/brand-brain" },
    ],
  },
  {
    group: "Media",
    items: [
      { label: "Budget & Scaling", icon: "⚖", href: "/app/budget-scaling" },
      { label: "Analytics", icon: "▲", href: "/app/analytics" },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { label: "Competitors", icon: "⚑", href: "/app/competitors" },
      { label: "Voice of Customer", icon: "❝", href: "/app/voice-of-customer" },
    ],
  },
  {
    group: "Account",
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
  return "Account Cockpit";
}
