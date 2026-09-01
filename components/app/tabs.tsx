"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

// Route-based tab bar for consolidated pages. Sets ?tab= (drops it for the first tab so
// the default URL stays clean) and keeps other query params (days). The page reads the
// tab on the server, so each tab's content stays a server component with real data.
export function Tabs({ tabs }: { tabs: { key: string; label: string }[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const active = params.get("tab") ?? tabs[0]?.key ?? "";

  function go(key: string) {
    const q = new URLSearchParams(Array.from(params.entries()));
    if (key === tabs[0]?.key) q.delete("tab");
    else q.set("tab", key);
    const qs = q.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--hairline)]">
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <Button
            key={t.key}
            type="button"
            variant="ghost"
            onClick={() => go(t.key)}
            className={
              on
                ? "-mb-px rounded-none border-b-2 border-[var(--ink)] px-3.5 py-2.5 text-sm font-semibold text-[var(--ink)]"
                : "-mb-px rounded-none border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
            }
          >
            {t.label}
          </Button>
        );
      })}
    </div>
  );
}
