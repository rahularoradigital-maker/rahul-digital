// Creative Production - DETERMINISTIC COMPOSITION (Phase 8, pure, no I/O).
// This is the "separate AI visual from ad composition" rule made real: the image model draws the
// VISUAL only (no text), and THIS module draws the approved headline/subhead/offer/CTA/logo as exact
// vector text on top - so copy never misspells and always sits in the format's safe zone. Output is a
// self-contained SVG string (fonts fall back to web-safe stacks; the AI visual is embedded as a data
// URI). PNG export happens in the browser (canvas) at download time, so there is no server raster dep.
import type { AdFormat, BrandDNA, ComposedAsset, GenerationBrief } from "@/lib/creative-production/types";
import { layoutFor, type Region } from "./layout.ts";
import type { Cutout } from "../media/background-removal.ts";

type ApprovedText = { headline: string; subhead: string; cta: string; offer: string | null };

// Composite the REAL product into its region. A transparent cutout floats with a soft shadow; an uncut real
// image (no removal key) is framed as a clean product card so it reads as intentional, never a pasted photo.
// preserveAspectRatio "meet" contains the product without distortion inside the box.
function productLayer(cut: Cutout, box: Region): string {
  const shadow = `<ellipse cx="${(box.x + box.w / 2).toFixed(1)}" cy="${(box.y + box.h * 0.94).toFixed(1)}" rx="${(box.w * 0.34).toFixed(1)}" ry="${(box.h * 0.045).toFixed(1)}" fill="#000000" opacity="0.18"/>`;
  if (cut.removed) {
    return `${shadow}<image href="${esc(cut.dataUri)}" x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.w.toFixed(1)}" height="${box.h.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  // Uncut real photo -> frame it as a rounded white card, inset a little, with a soft shadow.
  const pad = Math.min(box.w, box.h) * 0.06;
  const cardW = box.w - pad * 2;
  const cardH = box.h - pad * 2;
  const r = Math.min(cardW, cardH) * 0.06;
  return [
    shadow,
    `<rect x="${(box.x + pad).toFixed(1)}" y="${(box.y + pad).toFixed(1)}" width="${cardW.toFixed(1)}" height="${cardH.toFixed(1)}" rx="${r.toFixed(1)}" fill="#ffffff"/>`,
    `<image href="${esc(cut.dataUri)}" x="${(box.x + pad * 1.6).toFixed(1)}" y="${(box.y + pad * 1.6).toFixed(1)}" width="${(cardW - pad * 1.2).toFixed(1)}" height="${(cardH - pad * 1.2).toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>`,
  ].join("");
}

// XML-escape any user/derived string before it enters the SVG.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Relative luminance of a #rrggbb (or #rgb) colour, 0 (black) - 1 (white). Used to pick a contrasting ink so
// a CTA label / scrim is never light-on-light or dark-on-dark (the amateur-ad tell).
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return 0.5;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Black or white, whichever reads on the given background.
function contrastInk(bg: string): string {
  return luminance(bg) > 0.55 ? "#111114" : "#ffffff";
}

// A colour token that is real (not the UNKNOWN sentinel), else the fallback.
function color(v: string | "UNKNOWN", fallback: string): string {
  return v && v !== "UNKNOWN" ? v : fallback;
}
function font(v: string | "UNKNOWN", fallback: string): string {
  const f = v && v !== "UNKNOWN" ? `'${v.replace(/'/g, "")}', ` : "";
  return `${f}${fallback}`;
}

// Greedy word-wrap by an approximate glyph width (0.56em avg). Deterministic; no font metrics needed.
// Caps at maxLines, ellipsising the final line so text never overflows its region.
function wrap(text: string, regionW: number, fontSize: number, maxLines: number): string[] {
  const charW = fontSize * 0.56;
  const perLine = Math.max(1, Math.floor(regionW / charW));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= perLine || !line) line = next;
    else {
      lines.push(line);
      if (lines.length === maxLines) { line = ""; break; } // out of lines; this word + rest are dropped
      line = w;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  // Ellipsise ONLY when words were actually dropped (we filled every line and still had text left) - not
  // whenever the last line happened to be non-empty (the old bug that appended "…" to copy that fit fine).
  const rendered = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (lines.length === maxLines && rendered < words.length) {
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = last.length > perLine - 1 ? `${last.slice(0, perLine - 1)}…` : `${last}…`;
  }
  return lines.length ? lines : [""];
}

// Render one block of wrapped text, top-anchored inside its region, sized to fit the region height.
function textBlock(text: string, r: Region, opts: { color: string; font: string; weight: number; maxLines: number; align?: "start" | "middle"; shadow?: boolean }): string {
  if (!text) return "";
  const align = opts.align ?? "start";
  const anchorX = align === "middle" ? r.x + r.w / 2 : r.x;
  // Size so maxLines of line-height 1.15 fit the region height, capped so a 1-line headline isn't huge.
  const fontSize = Math.min(r.h / (opts.maxLines * 1.15), r.h * 0.9);
  const lines = wrap(text, r.w, fontSize, opts.maxLines);
  const lineH = fontSize * 1.15;
  const tspans = lines
    .map((l, i) => `<tspan x="${anchorX.toFixed(1)}" dy="${i === 0 ? 0 : lineH.toFixed(1)}">${esc(l)}</tspan>`)
    .join("");
  const filter = opts.shadow ? ` filter="url(#tshadow)"` : "";
  return `<text x="${anchorX.toFixed(1)}" y="${(r.y + fontSize).toFixed(1)}" font-family="${opts.font}" font-size="${fontSize.toFixed(1)}" font-weight="${opts.weight}" fill="${opts.color}" text-anchor="${align}"${filter}>${tspans}</text>`;
}

// A filled pill (CTA / offer badge) with centred label.
function pill(label: string, r: Region, fill: string, textColor: string, fontFamily: string): string {
  if (!label) return "";
  const radius = r.h / 2;
  const fontSize = Math.min(r.h * 0.42, (r.w * 0.85) / (label.length * 0.56 || 1));
  return [
    `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" rx="${radius.toFixed(1)}" fill="${fill}"/>`,
    `<text x="${(r.x + r.w / 2).toFixed(1)}" y="${(r.y + r.h / 2 + fontSize * 0.35).toFixed(1)}" font-family="${fontFamily}" font-size="${fontSize.toFixed(1)}" font-weight="700" fill="${textColor}" text-anchor="middle">${esc(label)}</text>`,
  ].join("");
}

/**
 * Compose the final creative SVG for one format.
 * @param brief          the generation brief (carries format + brand + concept)
 * @param approved       the approved copy (already generated + reviewed; drawn verbatim)
 * @param visualDataUri  the AI visual as a data URI (data:image/png;base64,...), or null (brand-colour fallback bg)
 */
export function compose(brief: GenerationBrief, approved: ApprovedText, visualDataUri: string | null, productCutout: Cutout | null = null): ComposedAsset {
  const format: AdFormat = brief.format;
  const b: BrandDNA = brief.brandDNA;
  const { width, height } = format;
  const hasOffer = !!approved.offer;
  const hasLogo = !!b.logoUrl;
  const L = layoutFor(format, { hasOffer, hasLogo });

  const bg = color(b.palette.background, "#0e0e10");
  const ink = color(b.palette.text, "#ffffff");
  const accent = color(b.palette.primary, "#3b6ef5");
  const headFont = font(b.fonts.heading, "system-ui, -apple-system, Segoe UI, Roboto, sans-serif");
  const bodyFont = font(b.fonts.body, "system-ui, -apple-system, Segoe UI, Roboto, sans-serif");

  // Text-over-photo legibility: when a real AI photo sits behind the copy, use WHITE text on a DARK gradient
  // scrim - the universal premium-ad convention that reads on ANY photo, regardless of brand palette (a
  // dark-ink brand over a dark photo was the unreadable case). On the solid-brand-colour fallback (no photo)
  // keep the brand's own ink, which already contrasts its background, and skip the scrim.
  const hasVisual = !!visualDataUri;
  const overlayInk = hasVisual ? "#ffffff" : ink;
  const scrimColor = "#0a0a0c";
  const parts: string[] = [];
  // defs: a soft vertical gradient scrim (transparent -> scrimColor) and a subtle text drop-shadow, so the
  // copy sits on a designed darkening instead of a hard rectangle and stays readable on any photo.
  parts.push(
    `<defs>` +
      `<linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${scrimColor}" stop-opacity="0"/>` +
      `<stop offset="55%" stop-color="${scrimColor}" stop-opacity="0.55"/>` +
      `<stop offset="100%" stop-color="${scrimColor}" stop-opacity="0.9"/>` +
      `</linearGradient>` +
      `<filter id="tshadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="${(height * 0.004).toFixed(1)}" stdDeviation="${(height * 0.005).toFixed(1)}" flood-color="${scrimColor}" flood-opacity="0.55"/></filter>` +
      `</defs>`,
  );
  // Background: solid brand colour, then the AI visual on top (cover) when present.
  parts.push(`<rect width="${width}" height="${height}" fill="${bg}"/>`);
  if (visualDataUri) {
    parts.push(`<image href="${esc(visualDataUri)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`);
  }

  // PRODUCT FIDELITY: for a "composite" format, drop the REAL product (cutout or framed photo) into its
  // region, on top of the generated scene. The image model is told not to draw the product, so this is the
  // only product on frame - guaranteeing it matches the Shopify listing exactly. Runs in BOTH scene and
  // background modes (before the pass-through return below), so scene formats get the real product too.
  if (brief.productMode === "composite" && productCutout) {
    parts.push(productLayer(productCutout, L.productBox));
  }

  // SCENE PASS-THROUGH: for an executional format whose native chrome text (search results, message bubbles,
  // review cards) is rendered INTO the image, do not overlay our own scrim/headline/CTA - that would double
  // the text and cover the format. Show the scene as-is. (Only when we actually have the AI scene; if the
  // model failed we fall through to the text fallback below so the ad is never blank.)
  if (brief.sceneText === "render" && visualDataUri) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
    return { formatId: format.id, width, height, svg };
  }
  // Legibility scrim behind the text zone (bottom of tall/square, right column of wide): a GRADIENT, not a
  // flat slab, so text sits on a smooth darkening that reads as designed. Only when a photo sits behind it -
  // on the solid brand-colour fallback the brand ink already contrasts, and a scrim would just muddy it.
  if (hasVisual) {
    const scrimTop = Math.max(0, L.headline.y - height * 0.08);
    parts.push(`<rect x="0" y="${scrimTop.toFixed(1)}" width="${width}" height="${(height - scrimTop).toFixed(1)}" fill="url(#scrim)"/>`);
  }

  // Logo (top-left of safe box) - drawn as the brand image when we have a URL.
  if (hasLogo && L.logo && b.logoUrl) {
    parts.push(`<image href="${esc(b.logoUrl)}" x="${L.logo.x.toFixed(1)}" y="${L.logo.y.toFixed(1)}" width="${L.logo.w.toFixed(1)}" height="${L.logo.h.toFixed(1)}" preserveAspectRatio="xMinYMin meet"/>`);
  }

  parts.push(textBlock(approved.headline, L.headline, { color: overlayInk, font: headFont, weight: 800, maxLines: 2, shadow: hasVisual }));
  parts.push(textBlock(approved.subhead, L.subhead, { color: overlayInk, font: bodyFont, weight: 400, maxLines: 2, shadow: hasVisual }));
  // Pills: label colour is chosen to CONTRAST the accent fill (never brand-background, which can match the
  // accent and vanish). Offer badge and CTA both read at a glance.
  if (hasOffer && L.offer && approved.offer) parts.push(pill(approved.offer, L.offer, accent, contrastInk(accent), headFont));
  parts.push(pill(approved.cta, L.cta, accent, contrastInk(accent), headFont));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
  return { formatId: format.id, width, height, svg };
}
