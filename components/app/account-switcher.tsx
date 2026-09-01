"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FILTER_TRIGGER, FILTER_LABEL } from "./control-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Acct = { externalId: string; name: string; businessName?: string };

// Topbar account switcher (BM -> Account), as a SEARCHABLE dropdown - a token can reach 200+
// ad accounts, so a plain select is unusable. Self-fetches client-side (never slows render),
// caches in sessionStorage for a few minutes. Picking an account switches which account the
// whole dashboard analyses (server-side, via the select-account route).
export function AccountSwitcher() {
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [active, setActive] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const CACHE_KEY = "adbrain.accounts";
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { at: number; accounts: Acct[]; activeExternalId: string };
        if (Date.now() - cached.at < 5 * 60 * 1000) {
          setAccounts(cached.accounts ?? []);
          setActive(cached.activeExternalId ?? "");
          setLoaded(true);
          return () => {
            alive = false;
          };
        }
      }
    } catch {
      // ignore cache read errors
    }
    fetch("/api/meta/accounts")
      .then((r) => r.json())
      .then((d: { accounts?: Acct[]; activeExternalId?: string }) => {
        if (!alive) return;
        setAccounts(d.accounts ?? []);
        setActive(d.activeExternalId ?? "");
        setLoaded(true);
        try {
          sessionStorage.setItem("adbrain.accounts", JSON.stringify({ at: Date.now(), accounts: d.accounts ?? [], activeExternalId: d.activeExternalId ?? "" }));
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
    if (!q) return accounts;
    return accounts.filter((a) => a.name.toLowerCase().includes(q) || (a.businessName ?? "").toLowerCase().includes(q));
  }, [accounts, query]);

  if (!loaded || accounts.length === 0) return null;

  function connect() {
    window.location.href = "/api/connect/meta/authorize";
  }
  function choose(a: Acct) {
    try {
      sessionStorage.removeItem("adbrain.accounts");
    } catch {
      // ignore
    }
    window.location.href = `/api/connect/meta/select-account?id=${encodeURIComponent(a.externalId)}&name=${encodeURIComponent(a.name)}`;
  }

  const activeName = accounts.find((a) => a.externalId === active)?.name ?? "Select account";

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={FILTER_TRIGGER}
      >
        <span className={FILTER_LABEL}>Account</span>
        <span className="max-w-[150px] truncate">{activeName}</span>
        <span className={FILTER_LABEL}>▾</span>
      </Button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-80 max-w-[85vw] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-lg">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts..."
            aria-label="Search accounts"
            className="mb-1.5 w-full rounded-lg border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
          />
          <div className="max-h-72 overflow-y-auto">
            {filtered.map((a) => (
              <Button
                key={a.externalId}
                type="button"
                variant="ghost"
                onClick={() => choose(a)}
                title={a.businessName ? `${a.name} · ${a.businessName}` : a.name}
                className={`block h-auto w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--surface-alt)] ${a.externalId === active ? "bg-[var(--surface-alt)]" : ""}`}
              >
                <div className={`truncate text-[13px] ${a.externalId === active ? "font-semibold text-[var(--accent)]" : "text-[var(--ink)]"}`}>{a.name}</div>
                {a.businessName && <div className="truncate text-[11px] text-[var(--ink-muted)]">{a.businessName}</div>}
              </Button>
            ))}
            {filtered.length === 0 && <div className="px-2.5 py-2 text-[13px] text-[var(--ink-muted)]">No accounts match.</div>}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={connect}
            className="mt-1 w-full justify-start rounded-none border-t border-[var(--surface-alt)] px-2.5 py-2 text-left text-[13px] font-medium text-[var(--accent)] transition hover:bg-[var(--surface-alt)]"
          >
            + Connect more accounts
          </Button>
        </div>
      ) : null}
    </div>
  );
}
