"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";

type Camp = { id: string; name: string; objective?: string };

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const parts = document.cookie.split("; ");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx > -1 && p.slice(0, idx) === name) return decodeURIComponent(p.slice(idx + 1));
  }
  return "";
}

// Campaign filter for the active account, as a SEARCHABLE MULTI-SELECT dropdown (accounts can
// have 100+ campaigns). Self-fetches; stores the chosen ids as a comma-separated list in the
// "adbrain.campaign" cookie which loadCockpit reads server-side, then refreshes so every page
// re-scopes. Empty = all campaigns.
export function CampaignSwitcher() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Camp[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [objSel, setObjSel] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // The objective filter lives in a sibling component; router.refresh() does not remount this
  // one, so re-read the objectives cookie fresh whenever the dropdown opens - that is how the
  // campaign list stays in sync with the objective the user just picked.
  function readObjectives(): Set<string> {
    const raw = readCookie("adbrain.objectives");
    return new Set(raw ? raw.split(",").filter(Boolean) : []);
  }

  useEffect(() => {
    const raw = readCookie("adbrain.campaign");
    setSel(new Set(raw ? raw.split(",").filter(Boolean) : []));
    setObjSel(readObjectives());
    let alive = true;
    fetch("/api/meta/campaigns")
      .then((r) => r.json())
      .then((d: { campaigns?: Camp[] }) => {
        if (!alive) return;
        setCampaigns(d.campaigns ?? []);
        setLoaded(true);
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
    return campaigns.filter((c) => {
      // Only show campaigns matching the selected objective(s); empty = all objectives.
      if (objSel.size > 0 && !(c.objective && objSel.has(c.objective))) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [campaigns, query, objSel]);

  if (!loaded || campaigns.length === 0) return null;

  function apply(next: Set<string>) {
    setSel(next);
    const val = [...next].join(",");
    document.cookie = `adbrain.campaign=${encodeURIComponent(val)}; path=/; max-age=${val ? 60 * 60 * 24 * 30 : 0}`;
    startTransition(() => router.refresh());
  }

  function toggle(id: string) {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  }

  const label = sel.size === 0 ? "All campaigns" : sel.size === 1 ? campaigns.find((c) => sel.has(c.id))?.name ?? "1 campaign" : `${sel.size} campaigns`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open) setObjSel(readObjectives()); // sync the list to the current objective before showing it
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={FILTER_TRIGGER}
      >
        <span className={FILTER_LABEL}>Campaign</span>
        <span className="max-w-[150px] truncate">{label}</span>
        <span className={FILTER_LABEL}>▾</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-80 max-w-[85vw] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns..."
            aria-label="Search campaigns"
            className="mb-1.5 w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
          />
          <div className="max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => apply(new Set())}
              className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-[var(--surface-alt)] ${sel.size === 0 ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}
            >
              All campaigns
            </button>
            {filtered.map((c) => (
              <label
                key={c.id}
                title={c.name}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-[var(--ink)] transition hover:bg-[var(--surface-alt)]"
              >
                <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 accent-[var(--accent)]" />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
            {filtered.length === 0 && <div className="px-2.5 py-2 text-[13px] text-[var(--ink-muted)]">No campaigns match.</div>}
            {sel.size > 0 && (
              <button
                type="button"
                onClick={() => apply(new Set())}
                className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-[var(--ink-muted)] transition hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]"
              >
                Clear (show all)
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
