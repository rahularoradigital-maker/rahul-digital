"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Brand = { id: string; name: string; orgName: string; active: boolean; accountCount: number };

// Topbar BRAND switcher - the tenancy-scoped primary navigation. Lists only the brands this user may see
// (resolved server-side through org membership + per-brand grants), so an agency member never even sees a
// client they aren't assigned to. Picking a brand switches which brand the whole dashboard analyses.
export function BrandSwitcher() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const CACHE_KEY = "adbrain.brands";
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { at: number; brands: Brand[] };
        if (Date.now() - cached.at < 5 * 60 * 1000) {
          setBrands(cached.brands ?? []);
          setLoaded(true);
          return () => {
            alive = false;
          };
        }
      }
    } catch {
      // ignore cache read errors
    }
    fetch("/api/brands")
      .then((r) => r.json())
      .then((d: { brands?: Brand[] }) => {
        if (!alive) return;
        setBrands(d.brands ?? []);
        setLoaded(true);
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), brands: d.brands ?? [] }));
        } catch {
          // ignore cache write errors
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q) || b.orgName.toLowerCase().includes(q));
  }, [brands, query]);

  if (!loaded || brands.length === 0) return null;

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
    <div ref={ref} className="relative">
      <Button type="button" variant="outline" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} className={FILTER_TRIGGER}>
        <span className={FILTER_LABEL}>Brand</span>
        <span className="max-w-[150px] truncate">{activeName}</span>
        <span className={FILTER_LABEL}>▾</span>
      </Button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-80 max-w-[85vw] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-lg">
          <Input
            autoFocus
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
        </div>
      ) : null}
    </div>
  );
}
