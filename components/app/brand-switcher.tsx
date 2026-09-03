"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";
import { FilterPopover } from "./filter-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Brand = { id: string; name: string; orgName: string; active: boolean; accountCount: number };

// Topbar BRAND switcher - the tenancy-scoped primary navigation. Lists only the brands this user may see
// (resolved server-side through org membership + per-brand grants), so an agency member never even sees a
// client they aren't assigned to. Picking a brand switches which brand the whole dashboard analyses.
export function BrandSwitcher() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false); // brand list failed to load -> surface a retry, never vanish silently

  // Fetch (or re-fetch, on retry) the brand list. On failure set `error` + `loaded` so the switcher can
  // show a retry chip rather than disappearing (silent-failure guard, charter Phase 12).
  const loadBrands = useCallback(() => {
    setError(false);
    fetch("/api/brands")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { brands?: Brand[] }) => {
        setBrands(d.brands ?? []);
        setLoaded(true);
        try {
          sessionStorage.setItem("adbrain.brands", JSON.stringify({ at: Date.now(), brands: d.brands ?? [] }));
        } catch {
          // ignore cache write errors
        }
      })
      .catch(() => {
        setError(true);
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    const CACHE_KEY = "adbrain.brands";
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { at: number; brands: Brand[] };
        if (Date.now() - cached.at < 5 * 60 * 1000) {
          setBrands(cached.brands ?? []);
          setLoaded(true);
          return;
        }
      }
    } catch {
      // ignore cache read errors
    }
    loadBrands();
  }, [loadBrands]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q) || b.orgName.toLowerCase().includes(q));
  }, [brands, query]);

  if (!loaded) return null;
  if (brands.length === 0) {
    // Genuinely no brands visible to this user -> stay hidden. But if the list FAILED to load, surface a
    // retry so the user is never silently stuck without their tenancy switcher.
    if (!error) return null;
    return (
      <Button type="button" variant="outline" onClick={loadBrands} className={FILTER_TRIGGER} title="Could not load your brands. Click to retry.">
        <span className={FILTER_LABEL}>Brand</span>
        <span className="max-w-[150px] truncate text-[var(--warn-ink)]">Couldn&apos;t load · retry</span>
      </Button>
    );
  }

  const multiOrg = new Set(brands.map((b) => b.orgName)).size > 1;

  function connect() {
    window.location.href = "/api/connect/meta/authorize";
  }
  function choose(b: Brand) {
    try {
      sessionStorage.removeItem("adbrain.brands");
      sessionStorage.removeItem("adbrain.accounts");
    } catch {
      // ignore
    }
    window.location.href = `/api/brand/select?id=${encodeURIComponent(b.id)}`;
  }

  const activeName = brands.find((b) => b.active)?.name ?? "Select brand";

  return (
    <FilterPopover label="Brand" summary={activeName} dialogLabel="Switch brand" width="w-80 max-w-[85vw]">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search brands..."
        aria-label="Search brands"
        className="mb-1.5 w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
      />
      <div className="max-h-72 overflow-y-auto">
        {filtered.map((b) => (
          <Button
            key={b.id}
            type="button"
            variant="ghost"
            onClick={() => choose(b)}
            title={`${b.name} · ${b.orgName}`}
            className={`block h-auto w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--surface-alt)] ${b.active ? "bg-[var(--surface-alt)]" : ""}`}
          >
            <div className={`truncate text-[13px] ${b.active ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}>{b.name}</div>
            {multiOrg && <div className="truncate text-[11px] text-[var(--ink-muted)]">{b.orgName}</div>}
          </Button>
        ))}
        {filtered.length === 0 && <div className="px-2.5 py-2 text-[13px] text-[var(--ink-muted)]">No brands match.</div>}
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={connect}
        className="mt-1 w-full justify-start rounded-none border-t border-[var(--surface-alt)] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--accent)] transition hover:bg-[var(--surface-alt)]"
      >
        + Connect account
      </Button>
    </FilterPopover>
  );
}
