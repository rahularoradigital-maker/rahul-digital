"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ACTION_TOKENS } from "@/lib/billing/plans";
import { FormatCoveragePanel } from "./format-coverage-panel";
import { makeZip, type ZipEntry } from "@/lib/creative-production/media/zip";
import { META_DEFAULT_SET, GOOGLE_DEFAULT_SET } from "@/lib/creative-production/formats/ad-formats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Cost of one image-generation run, from the shared meter weights (single source of truth).
const IMAGE_TOKENS = ACTION_TOKENS.image;

// Creative Studio workflow (Phases 10, 14, 22, 27, 28 UI). A guided 3-step flow drives the whole thing:
//   STEP 1 Products  — connect/sync, pick up to 10, then Continue
//   STEP 2 Concepts  — switch between the picked products; each shows formula-ranked concepts; Generate assets
//   STEP 3 Review    — every generated asset in one place; approve / reject / download (export)
// Everything is DRAFTS: nothing is auto-published to Meta. Provider-independent: with no image key the
// pipeline composes deterministic placeholders so the flow is fully testable end-to-end.

type Product = { productId: string; title: string; description: string; price: number | null; compareAtPrice: number | null; image: string | null; status: string | null; productType: string | null };
type Rec = { productId: string; title: string; price: number | null; compareAtPrice: number | null; image: string | null; productType: string | null; discountPct: number; saving: number; advertised: boolean; reason: string };
// What Studio derived about a product (a subset of Product DNA). Fields may be the literal "UNKNOWN".
type ProductDNA = { name: string; category: string; primaryBenefit: string; problemSolved: string; targetPersona: string; usps: string[]; proof: string[]; confidence: number };
type Concept = { id: string; formatId: string; headline: string; supportingCopy: string; cta: string; offer: string | null; angle: string; whyThisConcept: string; whyNow: string; score: number; awarenessStage: string; visualDirection: string };
type QA = { status: "READY" | "REVIEW" | "FAILED"; checks: { name: string; pass: boolean; severity: string; detail: string }[] };
type Asset = { creativeId: string; conceptId?: string; productId?: string; formatId: string; provider: string; model?: string; generationState?: string; qa: QA; approval: string; costUsd: number; url: string | null };
type Brand = { palette: { primary: string; secondary: string; background: string; text: string }; fonts: { heading: string; body: string }; imageStyle: string; designStyle: string; ctaStyle: string; tone: string; density: string; source: string; version: number };
type Step = "products" | "concepts" | "review";
// A partial brand override the Brand Control Panel sends; effective DNA = merge(derived, override) server-side.
type BrandOverride = { palette?: Partial<Brand["palette"]>; fonts?: Partial<Brand["fonts"]>; imageStyle?: string; designStyle?: string; ctaStyle?: string; tone?: string; density?: string };

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
// Core: fetch the stored SVG and rasterise it to a PNG Blob via canvas. Returns null if the canvas is tainted
// by a cross-origin image (only when a brand logo/product image is an external URL) or toBlob is unsupported.
async function svgUrlToPngBlob(url: string): Promise<Blob | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
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
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")); // throws SecurityError if tainted -> caught below
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Meta/Google want PNG, not SVG. Falls back to opening the SVG if rasterisation fails.
async function downloadAssetPng(url: string, filename: string): Promise<"png" | "svg"> {
  const png = await svgUrlToPngBlob(url);
  if (!png) {
    window.open(url, "_blank", "noopener"); // graceful fallback: still hand over the asset
    return "svg";
  }
  triggerDownload(png, filename);
  return "png";
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
  const [hasMore, setHasMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [recs, setRecs] = useState<Rec[]>([]);
  const [recBasis, setRecBasis] = useState<string | null>(null);
  const firstRun = useRef(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [conceptsByProduct, setConceptsByProduct] = useState<Record<string, Concept[]>>({});
  const [dnaByProduct, setDnaByProduct] = useState<Record<string, ProductDNA>>({});
  // Per-concept copy edits (headline/subhead/cta/offer). Sent as overrides at generate time; edited copy
  // makes a distinct asset, it does not overwrite the AI original.
  const [copyEdits, setCopyEdits] = useState<Record<string, { headline?: string; supportingCopy?: string; cta?: string; offer?: string | null }>>({});
  const [editingCopy, setEditingCopy] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [step, setStep] = useState<Step>("products");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [platform, setPlatform] = useState<"meta" | "google">("meta");
  const [deselFormats, setDeselFormats] = useState<Set<string>>(new Set()); // formats the user turned OFF (empty = all on)
  const [reviewFilter, setReviewFilter] = useState<string>("all");
  const [campaignName, setCampaignName] = useState("");
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
  const fetchProducts = useCallback(async (term: string, typeFilter: string, silent: boolean, offset = 0) => {
    if (!silent && offset === 0) setLoading(true);
    try {
      const p = new URLSearchParams();
      if (term) p.set("q", term);
      if (typeFilter) p.set("type", typeFilter);
      if (offset) p.set("offset", String(offset));
      const qs = p.toString();
      const r = await jsonFetch<{ connected: boolean; shopDomain: string | null; currency: string | null; products: Product[]; total?: number; hasMore?: boolean; types?: { type: string; n: number }[] | null }>(
        "/api/creative-production/products" + (qs ? `?${qs}` : ""),
      );
      setConnected(r.connected);
      setShopDomain(r.shopDomain);
      setCurrency(r.currency);
      setProducts((prev) => (offset > 0 ? [...prev, ...r.products] : r.products)); // append on "Load more"
      setTotal(r.total ?? r.products.length);
      setHasMore(!!r.hasMore);
      if (r.types) setTypes(r.types); // only returned on the base load; keep the last non-null list
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      if (!silent && offset === 0) setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(() => fetchProducts("", "", false), [fetchProducts]);
  const loadMore = useCallback(() => {
    setMoreBusy(true);
    void fetchProducts(query, activeType, true, products.length).finally(() => setMoreBusy(false));
  }, [fetchProducts, query, activeType, products.length]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  // Remember the picked products across refreshes (picking from a large catalogue is real work to redo).
  // localStorage can throw (private mode / blocked storage), so every access is guarded.
  const selectionLoaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cp-studio-selected");
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr)) setSelected(arr.filter((x) => typeof x === "string").slice(0, MAX_SELECT));
    } catch { /* storage unavailable - start empty */ }
    selectionLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!selectionLoaded.current) return; // don't overwrite before the initial read
    try { localStorage.setItem("cp-studio-selected", JSON.stringify(selected)); } catch { /* ignore */ }
  }, [selected]);

  // Debounced refetch when the search text or the category chip changes (skips the initial mount).
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (!connected) return;
    const t = setTimeout(() => { void fetchProducts(query, activeType, true); }, 300);
    return () => clearTimeout(t);
  }, [query, activeType, connected, fetchProducts]);

  // Recommended products to advertise (grounded offer-strength ranking). Best-effort; never blocks the picker.
  useEffect(() => {
    if (!connected) return;
    jsonFetch<{ recommendations: Rec[]; basis: string | null }>("/api/creative-production/recommendations")
      .then((r) => { setRecs(r.recommendations); setRecBasis(r.basis); })
      .catch(() => {});
  }, [connected]);

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
      const r = await jsonFetch<{ product?: ProductDNA; concepts: Concept[] }>("/api/creative-production/concepts", { method: "POST", body: JSON.stringify({ productId: id }) });
      setConceptsByProduct((prev) => ({ ...prev, [id]: r.concepts }));
      if (r.product) setDnaByProduct((prev) => ({ ...prev, [id]: r.product as ProductDNA }));
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
  const saveBrand = (override: BrandOverride) => run("brand", async () => {
    const r = await jsonFetch<{ brand: Brand }>("/api/creative-production/brand", { method: "POST", body: JSON.stringify({ action: "override", override }) });
    setBrand(r.brand);
  });

  // The ad sizes to generate = the current platform's set minus any the user turned off.
  const activeFormatIds = () => (platform === "google" ? GOOGLE_DEFAULT_SET : META_DEFAULT_SET).map((f) => f.id).filter((id) => !deselFormats.has(id));

  const generate = (conceptId: string) => run("gen:" + conceptId, async () => {
    if (!active) return;
    const overrides = copyEdits[conceptId];
    await jsonFetch("/api/creative-production/generate", { method: "POST", body: JSON.stringify({ conceptId, productId: active, platform, formatIds: activeFormatIds(), overrides }) });
    await refreshAssets();
    refreshUsage(); // generation spent tokens - keep the cost preview honest
  });

  const setCopyField = (id: string, field: "headline" | "supportingCopy" | "cta" | "offer", value: string) =>
    setCopyEdits((p) => ({ ...p, [id]: { ...p[id], [field]: value } }));

  // Batch: generate ads for the TOP concept of every selected product in one go. Sequential (one product at
  // a time) so cost is predictable and a mid-run token exhaustion (402) stops cleanly with what was made kept.
  const batchGenerate = () => run("batch", async () => {
    const ids = selected.slice();
    if (ids.length === 0) { setErr("Select products first."); return; }
    const cache = { ...conceptsByProduct };
    for (let i = 0; i < ids.length; i++) {
      const pid = ids[i];
      setBatchProgress(`${i + 1}/${ids.length}`);
      let cs = cache[pid];
      if (!cs) {
        const r = await jsonFetch<{ concepts: Concept[] }>("/api/creative-production/concepts", { method: "POST", body: JSON.stringify({ productId: pid }) });
        cs = r.concepts; cache[pid] = cs;
        setConceptsByProduct((p) => ({ ...p, [pid]: cs }));
      }
      const top = cs[0]; // highest-scored concept (list is score-desc)
      if (!top) continue;
      await jsonFetch("/api/creative-production/generate", { method: "POST", body: JSON.stringify({ conceptId: top.id, productId: pid, platform, formatIds: activeFormatIds() }) });
    }
    setBatchProgress("");
    await refreshAssets();
    refreshUsage();
    setStep("review");
  });

  const setApproval = (creativeId: string, approval: string) => run("appr:" + creativeId, async () => {
    await jsonFetch("/api/creative-production/assets", { method: "POST", body: JSON.stringify({ creativeId, approval }) });
    setAssets((prev) => prev.map((a) => (a.creativeId === creativeId ? { ...a, approval } : a)));
  });

  // Bulk review: apply an approval to every asset matching a predicate (e.g. approve all QA-READY). Sequential
  // so the DB isn't hammered; shows progress; each success updates local state so the grid reflects it live.
  const bulkSetApproval = (key: string, predicate: (a: Asset) => boolean, approval: string) => run(key, async () => {
    const targets = assets.filter(predicate);
    for (let i = 0; i < targets.length; i++) {
      setBatchProgress(`${i + 1}/${targets.length}`);
      const id = targets[i].creativeId;
      await jsonFetch("/api/creative-production/assets", { method: "POST", body: JSON.stringify({ creativeId: id, approval }) });
      setAssets((prev) => prev.map((a) => (a.creativeId === id ? { ...a, approval } : a)));
    }
    setBatchProgress("");
  });

  const enterReview = () => run("review", async () => { await refreshAssets(); setStep("review"); });

  const downloadAsset = (asset: Asset) => run("dl:" + asset.creativeId, async () => {
    if (!asset.url) return;
    const kind = await downloadAssetPng(asset.url, `adscale-${asset.formatId}.png`);
    if (kind === "svg") setErr("Couldn't rasterise this one in the browser (it has an external image) — opened the SVG instead.");
  });

  // Export every APPROVED ad as PNGs in one ZIP, named product-format, ready to hand to a media buyer.
  const exportApprovedZip = () => run("zip", async () => {
    const approved = assets.filter((a) => a.approval === "approved" && a.url);
    if (approved.length === 0) { setErr("No approved ads yet — approve some in Review first."); return; }
    // Look up the concept behind each asset (for the manifest copy), from whatever concepts are loaded.
    const conceptById = new Map(Object.values(conceptsByProduct).flat().map((c) => [c.id, c] as const));
    const camp = campaignName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40); // optional campaign prefix
    const csv = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const manifestRows = ["file,product,format,headline,cta,offer,qa"]; // header

    const entries: ZipEntry[] = [];
    let failed = 0;
    for (let i = 0; i < approved.length; i++) {
      const a = approved[i];
      setBatchProgress(`${i + 1}/${approved.length}`);
      const png = await svgUrlToPngBlob(a.url!);
      if (!png) { failed++; continue; }
      const slug = (a.productId ? productTitle(a.productId) : "ad").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "ad";
      const file = `${camp ? camp + "-" : ""}${slug}-${a.formatId}.png`;
      entries.push({ name: file, data: new Uint8Array(await png.arrayBuffer()) });
      const c = a.conceptId ? conceptById.get(a.conceptId) : undefined;
      manifestRows.push([file, a.productId ? productTitle(a.productId) : "", a.formatId, c?.headline ?? "", c?.cta ?? "", c?.offer ?? "", a.qa?.status ?? ""].map(csv).join(","));
    }
    setBatchProgress("");
    if (entries.length === 0) { setErr("Could not rasterise the approved ads to PNG."); return; }
    // A media-buyer manifest: which PNG is which product/concept/format, at the root of the zip.
    entries.push({ name: "manifest.csv", data: new TextEncoder().encode(manifestRows.join("\r\n") + "\r\n") });
    const stamp = new Date().toISOString().slice(0, 10);
    const zipBytes = makeZip(entries); // fresh exact-size Uint8Array, so .buffer is the whole zip
    triggerDownload(new Blob([zipBytes.buffer as ArrayBuffer], { type: "application/zip" }), `adscale-${camp ? camp + "-" : ""}approved-${stamp}.zip`);
    if (failed > 0) setErr(`Exported ${entries.length} PNG${entries.length === 1 ? "" : "s"}; ${failed} couldn't be rasterised (external image) and were skipped.`);
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
            <Input value={formDomain} onChange={(e) => setFormDomain(e.target.value)} placeholder="your-store.com" className="min-w-[280px] flex-1 rounded-xl border border-border bg-card text-card-foreground shadow-sm px-3 py-2 text-[13px]" />
            <Button variant="default" className={BTN_PRIMARY} disabled={busy === "connect" || !formDomain.trim()} onClick={connect}>{busy === "connect" ? "Fetching products…" : "Fetch products"}</Button>
          </div>
          <details className="text-[12px] text-[var(--ink-muted)]">
            <summary className="cursor-pointer select-none">Have an Admin API token? (optional — for private/full data)</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input value={formToken} onChange={(e) => setFormToken(e.target.value)} placeholder="shpat_… (Admin API token)" className="min-w-[280px] flex-1 rounded-xl border border-border bg-card text-card-foreground shadow-sm px-3 py-2 text-[13px]" />
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
            {selected.length > 0 || step !== "products" ? <button className="ml-auto text-[12px] text-[var(--accent)] hover:underline" onClick={() => { setSelected([]); setCampaignName(""); setDeselFormats(new Set()); setActive(null); setEditingCopy(null); setStep("products"); }}>Start new batch</button> : null}
            <span className={`${selected.length > 0 || step !== "products" ? "" : "ml-auto"} text-[12px] text-[var(--ink-muted)]`}>{shopDomain} · {products.length} products</span>
          </div>

          {step === "products" ? (
            <div className="space-y-6">
            {recs.length > 0 ? (
              <div className={`${CARD} p-4`}>
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="text-[15px] font-medium">✨ Recommended to advertise</h2>
                  <button
                    className="ml-auto text-[12px] text-[var(--accent)] hover:underline disabled:opacity-40"
                    disabled={recs.every((r) => selected.includes(r.productId))}
                    onClick={() => setSelected((prev) => { const room = MAX_SELECT - prev.length; const add = recs.map((r) => r.productId).filter((id) => !prev.includes(id)).slice(0, room); if (recs.length && add.length === 0 && prev.length >= MAX_SELECT) setErr(`Selection is full (${MAX_SELECT}).`); return [...prev, ...add]; })}
                  >
                    Select top {Math.min(recs.length, MAX_SELECT)}
                  </button>
                </div>
                {recBasis ? <p className="mb-3 text-[12px] text-[var(--ink-muted)]">{recBasis}</p> : null}
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {recs.map((r) => {
                    const isSel = selected.includes(r.productId);
                    return (
                      <div key={r.productId} className={`flex w-[150px] shrink-0 flex-col rounded-[12px] border p-2.5 ${isSel ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : "border-[var(--hairline)]"}`}>
                        {r.image ? <img src={r.image} alt="" className="mb-2 h-20 w-full rounded-[8px] object-cover" /> : <div className="mb-2 h-20 w-full rounded-[8px] bg-[var(--hairline)]" />}
                        <p className="line-clamp-2 min-h-[32px] text-[12px] font-medium">{r.title}</p>
                        <p className="text-[12px] text-[var(--ink-muted)]">{money(r.price)}{r.discountPct > 0 ? <span className="ml-1 rounded-[4px] bg-[var(--accent)]/10 px-1 text-[11px] font-medium text-[var(--accent)]">{r.discountPct}% off</span> : null}</p>
                        {r.saving > 0 ? <p className="text-[11px] text-[var(--ink-muted)]">Save {money(r.saving)}</p> : null}
                        {r.advertised ? <p className="text-[11px] text-emerald-500">✓ already advertised</p> : <p className="text-[11px] text-[var(--accent)]">new — not advertised yet</p>}
                        <button className={`${isSel ? BTN_PRIMARY : BTN_GHOST} mt-2 py-1.5`} onClick={() => toggleSelect(r.productId)}>{isSel ? "Selected" : "Select"}</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className={`${CARD} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-medium">Pick products to advertise</h2>
                  <span className="text-[12px] text-[var(--ink-muted)]">{selected.length}/{MAX_SELECT} selected{selected.length > 0 ? <button className="ml-2 underline" onClick={() => setSelected([])}>Clear</button> : null}</span>
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <Input
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
                {hasMore ? (
                  <div className="mt-3 flex justify-center">
                    <button className={BTN_GHOST} disabled={moreBusy} onClick={loadMore}>{moreBusy ? "Loading…" : `Load more (${products.length} of ${total})`}</button>
                  </div>
                ) : null}
                <div className="mt-4 flex items-center justify-between">
                  <Button variant="outline" className={BTN_GHOST} disabled={busy === "sync"} onClick={sync}>{busy === "sync" ? "Syncing…" : "Re-sync catalogue"}</Button>
                  <Button variant="default" className={BTN_PRIMARY} disabled={selected.length === 0 || busy?.startsWith("concepts:")} onClick={continueToConcepts}>Continue to concepts ({selected.length}) →</Button>
                </div>
              </div>
              <BrandPanel brand={brand} busy={busy === "brand"} onDerive={deriveBrand} onReset={resetBrand} onSave={saveBrand} />
            </div>
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
                  <Button variant="default" className={`${BTN_PRIMARY} py-1.5`} onClick={enterReview}>Review all →</Button>
                </div>
              </div>

              {/* Format picker: choose which ad sizes to generate for the current platform (all on by default). */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] text-[var(--ink-muted)]">Sizes:</span>
                {(platform === "google" ? GOOGLE_DEFAULT_SET : META_DEFAULT_SET).map((f) => {
                  const on = !deselFormats.has(f.id);
                  return (
                    <button
                      key={f.id}
                      title={f.name}
                      className={`rounded-[var(--radius-pill)] px-2.5 py-1 text-[12px] font-medium transition ${on ? "bg-[var(--accent)] text-white" : "border border-[var(--hairline)] text-[var(--ink-muted)] hover:border-[var(--accent)]"}`}
                      onClick={() => setDeselFormats((prev) => { const n = new Set(prev); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })}
                    >
                      {f.aspectRatio}
                    </button>
                  );
                })}
                <span className="text-[11px] text-[var(--ink-muted)]">{activeFormatIds().length} of {(platform === "google" ? GOOGLE_DEFAULT_SET : META_DEFAULT_SET).length} selected</span>
                <button className="text-[11px] text-[var(--accent)] hover:underline" onClick={() => setDeselFormats(new Set())}>All</button>
                {platform === "meta" ? <button className="text-[11px] text-[var(--accent)] hover:underline" onClick={() => setDeselFormats(new Set(["meta-story-9x16", "meta-link-1.91x1"]))}>Feed only</button> : null}
              </div>

              {/* Batch: generate the top concept for every selected product in one go, cost shown up front. */}
              {selected.length > 1 ? (
                <div className={`${CARD} flex flex-wrap items-center justify-between gap-2 p-3`}>
                  <div className="text-[13px]">
                    <span className="font-medium">Generate ads for all {selected.length} products</span>
                    <span className="text-[12px] text-[var(--ink-muted)]"> · top concept × {activeFormatIds().length} size{activeFormatIds().length === 1 ? "" : "s"} = {selected.length * activeFormatIds().length} ads on {platform === "meta" ? "Meta" : "Google"} · ~{(selected.length * IMAGE_TOKENS).toLocaleString("en-US")} tokens{usage != null ? ` · ${usage.remaining.toLocaleString("en-US")} left` : ""}</span>
                  </div>
                  <button className={BTN_PRIMARY} disabled={busy === "batch" || activeFormatIds().length === 0 || (usage != null && (!usage.imageGen || usage.remaining < selected.length * IMAGE_TOKENS))} onClick={batchGenerate}>
                    {busy === "batch" ? `Generating ${batchProgress}…` : `⚡ Generate all (${selected.length})`}
                  </button>
                </div>
              ) : null}

              {/* Diversity: which of the 42 formats this brand has tested + what to try next. Refreshes when
                  new assets are generated (assets.length as the reload key). */}
              <FormatCoveragePanel reloadKey={assets.length} />

              {active && dnaByProduct[active] ? <ProductDNAPanel dna={dnaByProduct[active]} /> : null}

              {busy === "concepts:" + active ? <p className="text-[13px] text-[var(--ink-muted)]">Reading the product and ranking creative ideas…</p> : null}
              {(conceptsByProduct[active ?? ""] ?? []).map((c) => {
                const cAssets = assets.filter((a) => a.creativeId.includes(c.id));
                const ed = copyEdits[c.id] ?? {};
                const eff = {
                  headline: ed.headline ?? c.headline,
                  supportingCopy: ed.supportingCopy ?? c.supportingCopy,
                  cta: ed.cta ?? c.cta,
                  offer: ed.offer !== undefined ? ed.offer : c.offer,
                };
                const edited = ed.headline !== undefined || ed.supportingCopy !== undefined || ed.cta !== undefined || ed.offer !== undefined;
                return (
                  <div key={c.id} className={`${CARD} p-4 space-y-3`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium">{eff.headline || c.angle}{edited ? <span className="ml-2 rounded-[4px] bg-[var(--accent)]/10 px-1.5 text-[10px] font-medium text-[var(--accent)]">edited</span> : null}</p>
                        <p className="text-[12px] text-[var(--ink-muted)]">{c.formatId} · {c.awarenessStage} · match score {c.score}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          variant="default"
                          className={BTN_PRIMARY}
                          disabled={busy === "gen:" + c.id || activeFormatIds().length === 0 || (usage != null && (!usage.imageGen || usage.remaining < IMAGE_TOKENS))}
                          onClick={() => generate(c.id)}
                        >
                          {busy === "gen:" + c.id ? "Generating…" : cAssets.length ? "Regenerate" : "Generate ads"}
                        </Button>
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
                    {editingCopy === c.id ? (
                      <div className="grid grid-cols-1 gap-2 rounded-[10px] border border-[var(--hairline)] p-3 sm:grid-cols-2">
                        <label className="text-[11px] text-[var(--ink-muted)]">Headline
                          <input value={eff.headline} maxLength={120} onChange={(e) => setCopyField(c.id, "headline", e.target.value)} className="mt-1 w-full rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--ink)]" />
                        </label>
                        <label className="text-[11px] text-[var(--ink-muted)]">CTA
                          <input value={eff.cta} maxLength={40} onChange={(e) => setCopyField(c.id, "cta", e.target.value)} className="mt-1 w-full rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--ink)]" />
                        </label>
                        <label className="text-[11px] text-[var(--ink-muted)] sm:col-span-2">Supporting line
                          <input value={eff.supportingCopy} maxLength={200} onChange={(e) => setCopyField(c.id, "supportingCopy", e.target.value)} className="mt-1 w-full rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--ink)]" />
                        </label>
                        <label className="text-[11px] text-[var(--ink-muted)]">Offer
                          <input value={eff.offer ?? ""} maxLength={60} onChange={(e) => setCopyField(c.id, "offer", e.target.value)} className="mt-1 w-full rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1.5 text-[13px] text-[var(--ink)]" />
                        </label>
                        <div className="flex items-end gap-2">
                          <button className={`${BTN_GHOST} py-1.5`} onClick={() => setEditingCopy(null)}>Done</button>
                          {edited ? <button className="text-[12px] text-[var(--ink-muted)] underline" onClick={() => { setCopyEdits((p) => { const n = { ...p }; delete n[c.id]; return n; }); }}>Reset</button> : null}
                        </div>
                      </div>
                    ) : (
                      <>
                        {eff.supportingCopy ? <p className="text-[13px]">{eff.supportingCopy}</p> : null}
                        <div className="flex flex-wrap items-center gap-2 text-[12px]">
                          {eff.cta ? <span className="rounded-[6px] bg-[var(--hairline)] px-2 py-0.5">CTA: {eff.cta}</span> : null}
                          {eff.offer ? <span className="rounded-[6px] bg-[var(--hairline)] px-2 py-0.5">Offer: {eff.offer}</span> : null}
                          <button className="text-[12px] text-[var(--accent)] hover:underline" onClick={() => setEditingCopy(c.id)}>✎ Edit copy</button>
                        </div>
                      </>
                    )}
                    <p className="text-[12px] text-[var(--ink-muted)]"><span className="text-[var(--ink)]">Why this:</span> {c.whyThisConcept}</p>
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
                <Button variant="outline" className={`${BTN_GHOST}`} onClick={() => setStep("concepts")}>← Back to concepts</Button>
                <span className="ml-2 text-[12px] text-[var(--ink-muted)]">Filter:</span>
                {["all", "approved", "rejected", "draft"].map((f) => (
                  <button key={f} className={f === reviewFilter ? `${BTN_PRIMARY} py-1.5` : `${BTN_GHOST} py-1.5`} onClick={() => setReviewFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
                ))}
                {(() => {
                  const readyN = assets.filter((a) => a.qa?.status === "READY" && a.approval !== "approved").length;
                  const failedN = assets.filter((a) => a.qa?.status === "FAILED" && a.approval !== "rejected").length;
                  return (
                    <>
                      {readyN > 0 ? <button className={`${BTN_GHOST} py-1.5`} disabled={busy === "bulk-approve"} onClick={() => bulkSetApproval("bulk-approve", (a) => a.qa?.status === "READY" && a.approval !== "approved", "approved")}>{busy === "bulk-approve" ? `Approving ${batchProgress}…` : `✓ Approve all READY (${readyN})`}</button> : null}
                      {failedN > 0 ? <button className={`${BTN_GHOST} py-1.5`} disabled={busy === "bulk-reject"} onClick={() => bulkSetApproval("bulk-reject", (a) => a.qa?.status === "FAILED" && a.approval !== "rejected", "rejected")}>{busy === "bulk-reject" ? `Rejecting ${batchProgress}…` : `✕ Reject all FAILED (${failedN})`}</button> : null}
                    </>
                  );
                })()}
                <span className="ml-auto text-[12px] text-[var(--ink-muted)]">
                  {assets.filter((a) => a.approval === "approved").length} approved · {assets.filter((a) => a.approval === "rejected").length} rejected · {assets.length} total
                  {(() => { const cost = assets.reduce((s, a) => s + (a.costUsd || 0), 0); return cost > 0 ? ` · ~$${cost.toFixed(2)} generated` : ""; })()}
                </span>
                <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign name (optional)" className="w-[180px] rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 text-[12px]" />
                <button className={BTN_PRIMARY} disabled={busy === "zip" || assets.filter((a) => a.approval === "approved").length === 0} onClick={exportApprovedZip} title="Download every approved ad as PNGs in one ZIP, named by campaign">
                  {busy === "zip" ? `Zipping ${batchProgress}…` : "⬇ Export approved (ZIP)"}
                </button>
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

// Shows what Studio understood about the product before generating (the "understand" step). Honest:
// UNKNOWN fields render as "not stated on the page" so the user trusts nothing was invented.
function ProductDNAPanel({ dna }: { dna: ProductDNA }) {
  const v = (s: string) => (s && s !== "UNKNOWN" ? s : null);
  const rows: { label: string; value: string | null }[] = [
    { label: "Sells because", value: v(dna.primaryBenefit) },
    { label: "Solves", value: v(dna.problemSolved) },
    { label: "For", value: v(dna.targetPersona) },
    { label: "Key points", value: dna.usps.length ? dna.usps.slice(0, 4).join(" · ") : null },
    { label: "Proof", value: dna.proof.length ? dna.proof.slice(0, 3).join(" · ") : null },
  ];
  const conf = Math.round((dna.confidence ?? 0) * 100);
  return (
    <div className={`${CARD} space-y-2 p-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-medium">What Studio understood about this product</h3>
        <span className="text-[11px] text-[var(--ink-muted)]">read confidence {conf}%</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="text-[12px]">
            <span className="text-[var(--ink-muted)]">{r.label}: </span>
            {r.value ? <span>{r.value}</span> : <span className="italic text-[var(--ink-muted)]">not stated on the page</span>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-[var(--ink-muted)]">Grounded in your product page only. &quot;Not stated&quot; means the page didn&apos;t say it — Studio won&apos;t invent it.</p>
    </div>
  );
}

const BRAND_IMAGE_STYLES = ["photography", "lifestyle", "illustration", "flat", "minimal", "bold"];
const BRAND_DESIGN_STYLES = ["minimal", "bold", "editorial", "playful", "premium"];
const BRAND_CTA_STYLES = ["pill", "rounded", "square", "underline"];
const BRAND_DENSITIES = ["low", "medium", "high"];

function BrandPanel({ brand, busy, onDerive, onReset, onSave }: { brand: Brand | null; busy: boolean; onDerive: () => void; onReset: () => void; onSave: (override: BrandOverride) => void }) {
  const val = (v: string) => (v && v !== "UNKNOWN" ? v : "");
  const color = (v: string, fallback: string) => (v && v !== "UNKNOWN" ? v : fallback);
  const ctl = "min-w-0 flex-1 rounded-[8px] border border-[var(--hairline)] bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--ink)]";

  // Backend REPLACES the whole override object, so every save must carry the full current look (a one-field
  // save would wipe the others). Snapshot the effective values, apply the patch, send the lot.
  const save = (patch: BrandOverride) => {
    if (!brand) return;
    const snap: BrandOverride = {
      palette: { ...brand.palette },
      imageStyle: brand.imageStyle, designStyle: brand.designStyle, ctaStyle: brand.ctaStyle, tone: brand.tone, density: brand.density,
    };
    onSave({ ...snap, ...patch, palette: { ...snap.palette, ...(patch.palette ?? {}) } });
  };

  const colorRow = (label: string, k: keyof Brand["palette"], fallback: string) => (
    <label key={label} className="flex items-center justify-between gap-2">{label}
      <input type="color" defaultValue={color(brand!.palette[k], fallback)} onBlur={(e) => save({ palette: { [k]: e.target.value } })} className="h-6 w-10 rounded border border-[var(--hairline)]" />
    </label>
  );
  const selectRow = (label: string, current: string, options: string[], onPick: (v: string) => void) => (
    <label key={label} className="flex items-center justify-between gap-2">{label}
      <select value={val(current)} onChange={(e) => onPick(e.target.value || "UNKNOWN")} className={ctl}>
        <option value="">auto</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div className={`${CARD} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium">Brand look</h2>
        <div className="flex gap-2">
          <Button variant="outline" className={BTN_GHOST} disabled={busy} onClick={onReset}>Defaults</Button>
          <Button variant="default" className={BTN_PRIMARY} disabled={busy} onClick={onDerive}>{busy ? "…" : brand ? "Re-derive" : "Understand brand"}</Button>
        </div>
      </div>
      {!brand ? (
        <p className="text-[13px] text-[var(--ink-muted)]">Derive your brand identity from your store, then fine-tune it here. It becomes the default look for every ad.</p>
      ) : (
        <div className="space-y-2 text-[12px]">
          <p className="text-[var(--ink-muted)]">Source: {brand.source} · v{brand.version}</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {colorRow("Primary", "primary", "#3b6ef5")}
            {colorRow("Secondary", "secondary", "#111111")}
            {colorRow("Background", "background", "#0e0e10")}
            {colorRow("Text", "text", "#ffffff")}
            {selectRow("Image", brand.imageStyle, BRAND_IMAGE_STYLES, (v) => save({ imageStyle: v }))}
            {selectRow("Design", brand.designStyle, BRAND_DESIGN_STYLES, (v) => save({ designStyle: v }))}
            {selectRow("CTA", brand.ctaStyle, BRAND_CTA_STYLES, (v) => save({ ctaStyle: v }))}
            {selectRow("Density", brand.density, BRAND_DENSITIES, (v) => save({ density: v }))}
            <label className="col-span-2 flex items-center gap-2">Tone
              <input defaultValue={val(brand.tone)} onBlur={(e) => e.target.value !== val(brand.tone) && save({ tone: e.target.value || "UNKNOWN" })} className={ctl} />
            </label>
          </div>
          <p className="text-[11px] text-[var(--ink-muted)]">These become the default look for every ad. &quot;Defaults&quot; restores what we read from your store.</p>
        </div>
      )}
    </div>
  );
}
