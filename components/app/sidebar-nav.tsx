"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/lib/app/nav";

// The left-menu. Every item is a real route now; the active one is filled dark.
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="mt-1 flex-1 text-sm">
      {NAV_GROUPS.map((section) => (
        <div key={section.group}>
          <div className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            {section.group}
          </div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={
                      active
                        ? "flex items-center gap-3 rounded-lg bg-[var(--ink)] px-3 py-2.5 text-[13.5px] font-medium text-white"
                        : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-[var(--ink-muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
                    }
                  >
                    <span className="w-[18px] text-center">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
