"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ACTION_TOKENS } from "@/lib/billing/plans";
import { FormatCoveragePanel } from "./format-coverage-panel";

// Cost of one image-generation run, from the shared meter weights (single source of truth).
const IMAGE_TOKENS = ACTION_TOKENS.image;

// Creative Studio workflow (Phases 10, 14, 22, 27, 28 UI). A guided 3-step flow drives the whole thing:
//   STEP 1 Products  — connect/sync, pick up to 10, then Continue
//   STEP 2 Concepts  — switch between the picked products; each shows formula-ranked concepts; Generate assets
//   STEP 3 Review    — every generated asset in one place; approve / reject / download (export)
// Everything is DRAFTS: nothing is auto-published to Meta. Provider-independent: with no image key the
// pipeline composes deterministic placeholders so the flow is fully testable end-to-end.

type Product = { productId: string; title: string; description: string; price: number | null; compareAtPrice: number | null; image: string | null; status: string | null; productType: string | null };
type Concept = { id: string; formatId: string; headline: string; supportingCopy: string; cta: string; offer: string | null; angle: string; whyThisConcept: string; whyNow: string; score: number; awarenessStage: string; visualDirection: string };
type QA = { status: "READY" | "REVIEW" | "FAILED"; checks: { name: string; pass: boolean; severity: string; detail: string }[] };
type Asset = { creativeId: string; conceptId?: string; productId?: string; formatId: string; provider: string; model?: string; generationState?: string; qa: QA; approval: string; costUsd: number; url: string | null };
type Brand = { palette: { primary: string; secondary: string; background: string; text: string }; fonts: { heading: string; body: string }; imageStyle: string; designStyle: string; ctaStyle: string; tone: string; density: string; source: string; version: number };
type Step = "products" | "concepts" | "review";

const CARD = "rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)]";
const BTN = "rounded-[var(--radius-pill)] px-3.5 py-2 text-[13px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} bg-[var(--accent)] text-white hover:opacity-90`;
const BTN_GHOST = `${BTN} border border-[var(--hairline)] text-[var(--ink)] hover:border-[var(--accent)]`;
const MAX_SELECT = 10;
const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$", AED: "AED ", SGD: "S$", JPY: "¥" };

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

// Rasterise the stored SVG ad to a PNG in the browser (canvas) and download it — Meta/Google want PNG, not
// SVG. No server raster dependency. Falls back to opening the SVG if the canvas is tainted by a cross-origin
// image (rare: only when a brand logo/product image is an external URL) or toBlob is unsupported.
async function downloadAssetPng(url: string, filename: string): Promise<"png" | "svg"> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch the asset.");
  const svgText = await res.text();
  const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("SVG render failed"));
      i.src = blobUrl;
    });
    const w = img.naturalWidth || Number(svgText.match(/width="(\d+)"/)?.[1]) || 1080;
    const h = img.naturalHeight || Number(svgText.match(/height="(\d+)"/)?.[1]) || 1080;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, w, h);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")); // throws SecurityError if tainted
    if (!png) throw new Error("toBlob returned null");
    const a = document.createElement("a");
    const pngUrl = URL.createObjectURL(png);
    a.href = pngUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(pngUrl);
    return "png";
  } catch {
    window.open(url, "_blank", "noopener"); // graceful fallback: still hand over the asset
    return "svg";
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function CreativeStudio() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<{ type: string; n: number }[]>([]);
  const [activeType, setActiveType] = useState("");
  const firstRun = useRef(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [conceptsByProduct, setConceptsByProduct] = useState<Record<string, Concept[]>>({});
  const [assets, setAssets] = useState<Asset[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [step, setStep] = useState<Step>("products");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"meta" | "google">("meta");
  const [reviewFilter, setReviewFilter] = useState<string>("all");
  const [formDomain, setFormDomain] = useState("");
  const [formToken, setFormToken] = useState("");

  // Token meter for the point-of-action cost preview (Phase 4). Read-only, best-effort; refreshed after each
  // generation so "N left" stays honest. Never blocks the UI if /api/usage is unavailable.
  const [usage, setUsage] = useState<{ remaining: number; imageGen: boolean; planLabel: string } | null>(null);
  const refreshUsage = useCallback(() => {
    fetch("/api/usage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.remaining === "number") setUsage({ remaining: d.remaining, imageGen: !!d.imageGen, planLabel: d.planLabel });
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  const money = useCallback((n: number | null): string => {
    if (n == null) return "";
    const sym = currency ? CURRENCY_SYMBOL[currency] ?? `${currency} ` : "";
    return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }, [currency]);

  // term = search text; typeFilter = category chip; both filter the WHOLE catalogue server-side.
  // silent = don't flip the full-page loader (used while typing / switching category).
  const fetchProducts = useCallback(async (term: string, typeFilter: string, silent: boolean) => {
    if (!silent) setLoading(true);
    try {
      const p = new URLSearchParams();
      if (term) p.set("q", term);
      if (typeFilter) p.set("type", typeFilter);
      const qs = p.toString();
      const r = await jsonFetch<{ connected: boolean; shopDomain: string | null; currency: string | null; products: Product[]; total?: number; types?: { type: string; n: number }[] | null }>(
        "/api/creative-production/products" + (qs ? `?${qs}` : ""),
      );
      setConnected(r.connected);
      setShopDomain(r.shopDomain);
      setCurrency(r.currency);
      setProducts(r.products);
      setTotal(r.total ?? r.products.length);
      if (r.types) setTypes(r.types); // only returned on the base load; keep the last non-null list
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(() => fetchProducts("", "", false), [fetchProducts]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  // Debounced refetch when the search text or the category chip changes (skips the initial mount).
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (!connected) return;
    const t = setTimeout(() => { void fetchProducts(query, activeType, true); }, 300);
    return () => clearTimeout(t);
  }, [query, activeType, connected, fetchProducts]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setErr(null);
    setBusy(key);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(null); }
  };

  const refreshAssets = useCallback(async () => {
    const a = await jsonFetch<{ assets: Asset[] }>("/api/creative-production/assets");
    setAssets(a.assets);
  }, []);

  const connect = () => run("connect", async () => {
    await jsonFetch("/api/creative-production/shopify/connect", { method: "POST", body: JSON.stringify({ shopDomain: formDomain.trim(), accessToken: formToken.trim(), urlOnly: !formToken.trim() }) });
    await loadProducts();
  });

  const sync = () => run("sync", async () => { await jsonFetch("/api/creative-production/shopify/sync", { method: "POST" }); await loadProducts(); });

  const toggleSelect = (id: string) => {
    setErr(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= MAX_SELECT) { setErr(`You can select up to ${MAX_SELECT} products per batch.`); return prev; }
      return [...prev, id];
    });
  };

  // Concepts for one product: generate (if not already) + refresh assets. Cached in conceptsByProduct.
  const openProduct = (id: string) => run("concepts:" + id, async () => {
    setActive(id);
    if (!conceptsByProduct[id]) {
      const r = await jsonFetch<{ concepts: Concept[] }>("/api/creative-production/concepts", { method: "POST", body: JSON.stringify({ productId: id }) });
      setConceptsByProduct((prev) => ({ ...prev, [id]: r.concepts }));
    }
    await refreshAssets();
  });

  // STEP 1 -> STEP 2: move the whole selected batch into the concepts workspace, opening the first.
  const continueToConcepts = () => {
    if (selected.length === 0) { setErr("Select at least one product first."); return; }
    setStep("concepts");
    void openProduct(selected[0]);
  };

  const deriveBrand = () => run("brand", async () => {
    const r = await jsonFetch<{ brand: Brand }>("/api/creative-production/brand", { method: "POST", body: JSON.stringify({ action: "derive" }) });
    setBrand(r.brand);
  });
  const resetBrand = () => run("brand", async () => {
    const r = await jsonFetch<{ brand: Brand }>("/api/creative-production/brand", { method: "POST", body: JSON.stringify({ action: "reset" }) });
    setBrand(r.brand);
  });
  const saveBrandField = (field: "primary" | keyof Brand, value: string) => run("brand", async () => {
    const override = field === "primary" ? { palette: { primary: value } } : { [field]: value };
    const r = await jsonFetch<{ brand: Brand }>("/api/creative-production/brand", { method: "POST", body: JSON.stringify({ action: "override", override }) });
    setBrand(r.brand);
  });

  const generate = (conceptId: string) => run("gen:" + conceptId, async () => {
    if (!active) return;
    await jsonFetch("/api/creative-production/generate", { method: "POST", body: JSON.stringify({ conceptId, productId: active, platform }) });
    await refreshAssets();
    refreshUsage(); // generation spent tokens - keep the cost preview honest
  });

  const setApproval = (creativeId: string, approval: string) => run("appr:" + creativeId, async () => {
    await jsonFetch("/api/creative-production/assets", { method: "POST", body: JSON.stringify({ creativeId, approval }) });
    setAssets((prev) => prev.map((a) => (a.creativeId === creativeId ? { ...a, approval } : a)));
  });

  const enterReview = () => run("review", async () => { await refreshAssets(); setStep("review"); });

  const downloadAsset = (asset: Asset) => run("dl:" + asset.creativeId, async () => {
    if (!asset.url) return;
    const kind = await downloadAssetPng(asset.url, `adscale-${asset.formatId}.png`);
    if (kind === "svg") setErr("Couldn't rasterise this one in the browser (it has an external image) — opened the SVG instead.");
  });

  const productTitle = (id: string) => products.find((p) => p.productId === id)?.title ?? id;

  if (loading) return <p className="text-[14px] text-[var(--ink-muted)]">Loading Studio…</p>;

  const stepIndex = step === "products" ? 0 : step === "concepts" ? 1 : 2;

  return (
    <div className="space-y-6">
      {err ? <div className={`${CARD} border-red-500/40 bg-red-500/5 px-4 py-3 text-[13px] text-red-500`}>{err}</div> : null}

      {/* CONNECT */}
      {!connected ? (
        <div className={`${CARD} p-5 space-y-3`}>
          <h2 className="text-[16px] font-medium">Add your store</h2>
          <p className="text-[13px] text-[var(--ink-muted)]">Just paste your store website. If it is a Shopify store, Studio pulls in every published product automatically. No login or API key needed.</p>
          <div className="flex flex-wrap gap-2">
            <input value={formDomain} onChange={(e) => setFormDomain(e.target.value)} placeholder="your-store.com" className="min-w-[280px] flex-1 rounded-xl border border-border bg-card text-card-foreground shadow-sm px-3 py-2 text-[13px]" />
            <button className={BTN_PRIMARY} disabled={busy === "connect" || !formDomain.trim()} onClick={connect}>{busy === "connect" ? "Fetching products…" : "Fetch products"}</button>
          </div>
          <details className="text-[12px] text-[var(--ink-muted)]">
            <summary className="cursor-pointer select-none">Have an Admin API token? (optional — for private/full data)</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <input value={formToken} onChange={(e) => setFormToken(e.target.value)} placeholder="shpat_… (Admin API token)" className="min-w-[280px] flex-1 rounded-xl border border-border bg-card text-card-foreground shadow-sm px-3 py-2 text-[13px]" />
              <span className="text-[11px]">A token also pulls unpublished products, inventory and metafields. The public feed covers published products, prices and images.</span>
            </div>
          </details>
        </div>
      ) : (
        <>
          {/* STEPPER */}
          <div className="flex items-center gap-2 text-[13px]">
            {["1 · Products", "2 · Concepts", "3 · Review"].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <button
                  className={`rounded-[var(--radius-pill)] px-3 py-1.5 font-medium transition ${i === stepIndex ? "bg-[var(--accent)] text-white" : i < stepIndex ? "border border-[var(--accent)] text-[var(--accent)]" : "border border-[var(--hairline)] text-[var(--ink-muted)]"}`}
                  disabled={i === 1 && selected.length === 0}
                  onClick={() => setStep(i === 0 ? "products" : i === 1 ? "concepts" : "review")}
                >
                  {label}
                </button>
                {i < 2 ? <span className="text-[var(--ink-muted)]">→</span> : null}
              </div>
            ))}
            <span className="ml-auto text-[12px] text-[var(--ink-muted)]">{shopDomain} · {products.length} products</span>
          </div>

          {step === "products" ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className={`${CARD} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-medium">Pick products to advertise</h2>
                  <span className="text-[12px] text-[var(--ink-muted)]">{selected.length}/{MAX_SELECT} selected</span>
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products by name or type…"
                    className="min-w-0 flex-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-[13px]"
                  />
                  {query ? <button className="text-[12px] text-[var(--ink-muted)] underline" onClick={() => setQuery("")}>Clear</button> : null}
                  <span className="shrink-0 text-[12px] text-[var(--ink-muted)]">{query ? `${total} match${total === 1 ? "" : "es"}` : `${total} products`}{total > products.length ? ` · showing ${products.length}` : ""}</span>
                </div>
                {types.length > 1 ? (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <button className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] font-medium transition ${activeType === "" ? "bg-[var(--accent)] text-white" : "border border-[var(--hairline)] text-[var(--ink-muted)] hover:border-[var(--accent)]"}`} onClick={() => setActiveType("")}>All</button>
                    {types.map((t) => (
                      <button key={t.type} className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] font-medium transition ${activeType === t.type ? "bg-[var(--accent)] text-white" : "border border-[var(--hairline)] text-[var(--ink-muted)] hover:border-[var(--accent)]"}`} onClick={() => setActiveType(activeType === t.type ? "" : t.type)}>{t.type} <span className="opacity-60">{t.n}</span></button>
                    ))}
                  </div>
                ) : null}
                {products.length === 0 ? (
                  <p className="text-[13px] text-[var(--ink-muted)]">{query ? `No products match "${query}".` : <>No products yet. <button className="underline" onClick={sync}>Re-sync</button>.</>}</p>
                ) : (
                  <div className="grid max-h-[560px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {products.map((p) => {
                      const isSel = selected.includes(p.productId);
                      return (
                        <button key={p.productId} onClick={() => toggleSelect(p.productId)} className={`flex gap-2.5 rounded-[12px] border p-2.5 text-left transition ${isSel ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--hairline)] hover:border-[var(--accent)]"}`}>
                          {p.image ? <img src={p.image} alt="" className="h-14 w-14 shrink-0 rounded-[8px] object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-[8px] bg-[var(--hairline)]" />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium">{p.title}</p>
                            <p className="text-[12px] text-[var(--ink-muted)]">{money(p.price)}{p.compareAtPrice && p.price && p.compareAtPrice > p.price ? <span className="ml-1 line-through">{money(p.compareAtPrice)}</span> : null}</p>
                          </div>
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${isSel ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--hairline)]"}`}>{isSel ? "✓" : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <button className={BTN_GHOST} disabled={busy === "sync"} onClick={sync}>{busy === "sync" ? "Syncing…" : "Re-sync catalogue"}</button>
                  <button className={BTN_PRIMARY} disabled={selected.length === 0 || busy?.startsWith("concepts:")} onClick={continueToConcepts}>Continue to concepts ({selected.length}) →</button>
                </div>
              </div>
              <BrandPanel brand={brand} busy={busy === "brand"} onDerive={deriveBrand} onReset={resetBrand} onSave={saveBrandField} />
            </div>
          ) : null}

          {step === "concepts" ? (
            <div className="space-y-4">
              {/* product switcher for the selected batch */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-[var(--ink-muted)]">Product:</span>
                {selected.map((id) => (
                  <button key={id} className={`max-w-[200px] truncate rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-medium transition ${id === active ? "bg-[var(--accent)] text-white" : "border border-[var(--hairline)] hover:border-[var(--accent)]"}`} onClick={() => openProduct(id)}>{productTitle(id)}</button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[12px] text-[var(--ink-muted)]">Platform:</span>
                  {(["meta", "google"] as const).map((pf) => (
                    <button key={pf} className={pf === platform ? `${BTN_PRIMARY} py-1.5` : `${BTN_GHOST} py-1.5`} onClick={() => setPlatform(pf)}>{pf === "meta" ? "Meta" : "Google"}</button>
                  ))}
                  <button className={`${BTN_PRIMARY} py-1.5`} onClick={enterReview}>Review all →</button>
                </div>
              </div>

              {/* Diversity: which of the 42 formats this brand has tested + what to try next. Refreshes when
                  new assets are generated (assets.length as the reload key). */}
              <FormatCoveragePanel reloadKey={assets.length} />

              {busy === "concepts:" + active ? <p className="text-[13px] text-[var(--ink-muted)]">Reading the product and ranking creative ideas…</p> : null}
              {(conceptsByProduct[active ?? ""] ?? []).map((c) => {
                const cAssets = assets.filter((a) => a.creativeId.includes(c.id));
                return (
                  <div key={c.id} className={`${CARD} p-4 space-y-3`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium">{c.headline || c.angle}</p>
                        <p className="text-[12px] text-[var(--ink-muted)]">{c.formatId} · {c.awarenessStage} · match score {c.score}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <button
                          className={BTN_PRIMARY}
                          disabled={busy === "gen:" + c.id || (usage != null && (!usage.imageGen || usage.remaining < IMAGE_TOKENS))}
                          onClick={() => generate(c.id)}
                        >
                          {busy === "gen:" + c.id ? "Generating…" : cAssets.length ? "Regenerate" : "Generate ads"}
                        </button>
                        {/* Point-of-action cost preview (Phase 4): show the token cost + what's left, and route to
                            /pricing when the plan can't cover it - no silent 402 surprise. */}
                        {usage != null && !usage.imageGen ? (
                          <span className="text-[11px] text-[var(--ink-muted)]">Needs a paid plan · <Link href="/pricing" className="text-[var(--accent)] hover:underline">Upgrade</Link></span>
                        ) : usage != null && usage.remaining < IMAGE_TOKENS ? (
                          <span className="text-[11px] text-[var(--ink-muted)]">Not enough tokens · <Link href="/pricing" className="text-[var(--accent)] hover:underline">Upgrade</Link></span>
                        ) : (
                          <span className="text-[11px] text-[var(--ink-muted)]">Uses {IMAGE_TOKENS} tokens{usage != null ? ` · ${usage.remaining.toLocaleString("en-US")} left` : ""}</span>
                        )}
                      </div>
                    </div>
                    {c.supportingCopy ? <p className="text-[13px]">{c.supportingCopy}</p> : null}
                    <p className="text-[12px] text-[var(--ink-muted)]"><span className="text-[var(--ink)]">Why this:</span> {c.whyThisConcept}</p>
                    <div className="flex flex-wrap gap-2 text-[12px]">
                      {c.cta ? <span className="rounded-[6px] bg-[var(--hairline)] px-2 py-0.5">CTA: {c.cta}</span> : null}
                      {c.offer ? <span className="rounded-[6px] bg-[var(--hairline)] px-2 py-0.5">Offer: {c.offer}</span> : null}
                    </div>
                    {cAssets.length ? (
                      <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                        {cAssets.map((a) => <AssetCard key={a.creativeId} asset={a} busy={busy === "appr:" + a.creativeId || busy === "dl:" + a.creativeId} onApprove={() => setApproval(a.creativeId, "approved")} onReject={() => setApproval(a.creativeId, "rejected")} onDownload={() => downloadAsset(a)} />)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {active && !busy && (conceptsByProduct[active] ?? []).length === 0 ? <p className="text-[13px] text-[var(--ink-muted)]">No concepts yet for this product.</p> : null}
            </div>
          ) : null}

          {step === "review" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button className={`${BTN_GHOST}`} onClick={() => setStep("concepts")}>← Back to concepts</button>
                <span className="ml-2 text-[12px] text-[var(--ink-muted)]">Filter:</span>
                {["all", "approved", "rejected", "draft"].map((f) => (
                  <button key={f} className={f === reviewFilter ? `${BTN_PRIMARY} py-1.5` : `${BTN_GHOST} py-1.5`} onClick={() => setReviewFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
                ))}
                <span className="ml-auto text-[12px] text-[var(--ink-muted)]">{assets.filter((a) => a.approval === "approved").length} approved · {assets.length} total</span>
              </div>
              {assets.length === 0 ? (
                <p className="text-[13px] text-[var(--ink-muted)]">No generated ads yet. Go to Concepts and press <span className="text-[var(--ink)]">Generate ads</span>.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {assets.filter((a) => reviewFilter === "all" || a.approval === reviewFilter).map((a) => (
                    <AssetCard key={a.creativeId} asset={a} label={a.productId ? productTitle(a.productId) : undefined} busy={busy === "appr:" + a.creativeId || busy === "dl:" + a.creativeId} onApprove={() => setApproval(a.creativeId, "approved")} onReject={() => setApproval(a.creativeId, "rejected")} onDownload={() => downloadAsset(a)} />
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// The TRUTHFUL generation state - so a compositor-only fallback is never shown as a premium AI ad.
const MODEL_NAME: Record<string, string> = { "gemini-3-pro-image": "Nano Banana Pro", "gemini-3.1-flash-image": "Nano Banana 2", "gemini-2.5-flash-image": "Nano Banana" };
function genStateLabel(state: string | undefined, model: string | undefined): string {
  const m = model ? MODEL_NAME[model] ?? model : "AI";
  if (state === "AI_GENERATED") return m;
  if (state === "AI_GENERATED_WITH_FALLBACK") return `${m} · fallback`;
  if (state === "COMPOSITOR_ONLY") return "Compositor only · no AI image";
  if (state === "FAILED") return "Generation failed";
  return model ? m : "";
}
function genStateColor(state: string | undefined): string {
  return state === "COMPOSITOR_ONLY" || state === "FAILED" ? "text-red-500" : state === "AI_GENERATED_WITH_FALLBACK" ? "text-amber-500" : "text-[var(--ink-muted)]";
}
function qaColor(status: string): string {
  return status === "READY" ? "text-emerald-500" : status === "REVIEW" ? "text-amber-500" : "text-red-500";
}

function AssetCard({ asset, busy, label, onApprove, onReject, onDownload }: { asset: Asset; busy: boolean; label?: string; onApprove: () => void; onReject: () => void; onDownload: () => void }) {
  return (
    <div className={`rounded-[10px] border p-2 ${asset.approval === "approved" ? "border-emerald-500/50" : asset.approval === "rejected" ? "border-red-500/40 opacity-60" : "border-[var(--hairline)]"}`}>
      <div className="aspect-square overflow-hidden rounded-[6px] bg-[var(--hairline)]">
        {asset.url ? <img src={asset.url} alt={asset.formatId} className="h-full w-full object-contain" /> : null}
      </div>
      {label ? <p className="mt-1 truncate text-[11px] font-medium">{label}</p> : null}
      <p className="mt-1 truncate text-[11px] text-[var(--ink-muted)]">{asset.formatId}</p>
      <p className={`text-[11px] font-medium ${qaColor(asset.qa?.status ?? "")}`}>QA {asset.qa?.status ?? "?"}{asset.provider === "stub" ? " · placeholder" : ""}</p>
      <p className={`truncate text-[10px] ${genStateColor(asset.generationState)}`} title={asset.model ?? ""}>{genStateLabel(asset.generationState, asset.model)}</p>
      <div className="mt-1.5 flex gap-1">
        <button className={`flex-1 rounded-[6px] py-1 text-[11px] font-medium ${asset.approval === "approved" ? "bg-emerald-500 text-white" : "border border-[var(--hairline)]"}`} disabled={busy} onClick={onApprove} title="Approve">✓</button>
        <button className={`flex-1 rounded-[6px] py-1 text-[11px] font-medium ${asset.approval === "rejected" ? "bg-red-500 text-white" : "border border-[var(--hairline)]"}`} disabled={busy} onClick={onReject} title="Reject">✕</button>
        {asset.url ? <button className="flex-1 rounded-[6px] border border-[var(--hairline)] py-1 text-center text-[11px] font-medium disabled:opacity-40" disabled={busy} onClick={onDownload} title="Download PNG">↧ PNG</button> : null}
      </div>
    </div>
  );
}

function BrandPanel({ brand, busy, onDerive, onReset, onSave }: { brand: Brand | null; busy: boolean; onDerive: () => void; onReset: () => void; onSave: (field: "primary" | keyof Brand, value: string) => void }) {
  const val = (v: string) => (v && v !== "UNKNOWN" ? v : "");
  return (
    <div className={`${CARD} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium">Brand DNA</h2>
        <div className="flex gap-2">
          <button className={BTN_GHOST} disabled={busy} onClick={onReset}>Defaults</button>
          <button className={BTN_PRIMARY} disabled={busy} onClick={onDerive}>{busy ? "…" : brand ? "Re-derive" : "Understand brand"}</button>
        </div>
      </div>
      {!brand ? (
        <p className="text-[13px] text-[var(--ink-muted)]">Derive your brand identity from your store, then fine-tune it. It becomes the default look for every ad.</p>
      ) : (
        <div className="space-y-2 text-[12px]">
          <p className="text-[var(--ink-muted)]">Source: {brand.source} · v{brand.version} · tone {val(brand.tone) || "—"}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2">Primary
              <input type="color" value={val(brand.palette.primary) || "#3b6ef5"} onChange={(e) => onSave("primary", e.target.value)} className="h-6 w-10 rounded border border-[var(--hairline)]" />
            </label>
            <label className="flex items-center gap-2">Tone
              <input defaultValue={val(brand.tone)} onBlur={(e) => e.target.value !== val(brand.tone) && onSave("tone", e.target.value)} className="min-w-0 flex-1 rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
