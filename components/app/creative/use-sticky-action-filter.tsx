"use client";

import { useEffect, useState } from "react";
import { GROUP_ORDER, type ActionGroup } from "@/lib/creative/action-group";

type Filter = ActionGroup | "all";
const VALID: readonly Filter[] = ["all", ...GROUP_ORDER];

// Remember the buyer's last action-filter choice per surface (fatigue / diversity), so the tab
// reopens on the same filter. Client-only convenience: starts at "all" for a clean SSR render, then
// restores from localStorage after mount (avoids a hydration mismatch). Every access is guarded, so a
// private window or blocked storage silently falls back to "all" and never breaks the page.
export function useStickyActionFilter(key: string): [Filter, (f: Filter) => void] {
  const storageKey = `adscale.creative.${key}.action`;
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v && (VALID as readonly string[]).includes(v)) setFilter(v as Filter);
    } catch {
      /* storage blocked (private mode) - keep "all" */
    }
  }, [storageKey]);

  const update = (f: Filter) => {
    setFilter(f);
    try {
      localStorage.setItem(storageKey, f);
    } catch {
      /* best-effort - the filter still works this session */
    }
  };

  return [filter, update];
}
