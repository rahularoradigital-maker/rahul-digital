// Creative Production - DETERMINISTIC COMPOSITION (Phase 8, pure, no I/O).
// This is the "separate AI visual from ad composition" rule made real: the image model draws the
// VISUAL only (no text), and THIS module draws the approved headline/subhead/offer/CTA/logo as exact
// vector text on top - so copy never misspells and always sits in the format's safe zone. Output is a
// self-contained SVG string (fonts fall back to web-safe stacks; the AI visual is embedded as a data
// URI). PNG export happens in the browser (canvas) at download time, so there is no server raster dep.
import type { AdFormat, BrandDNA, ComposedAsset, GenerationBrief } from "@/lib/creative-production/types";
import { layoutFor, type Region } from "./layout.ts";

type ApprovedText = { headline: string; subhead: string; cta: string; offer: string | null };

// XML-escape any user/derived string before it enters the SVG.
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
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
      line = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && (line || words.length > lines.join(" ").split(/\s+/).length)) {
    // Something got truncated: ellipsise the last visible line.
    const last = lines[maxLines - 1] ?? "";
    lines[maxLines - 1] = last.length > perLine - 1 ? `${last.slice(0, perLine - 1)}…` : `${last}…`;
  }
  return lines.length ? lines : [""];
}

// Render one block of wrapped text, top-anchored inside its region, sized to fit the region height.
function textBlock(text: string, r: Region, opts: { color: string; font: string; weight: number; maxLines: number; align?: "start" | "middle" }): string {
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
  return `<text x="${anchorX.toFixed(1)}" y="${(r.y + fontSize).toFixed(1)}" font-family="${opts.font}" font-size="${fontSize.toFixed(1)}" font-weight="${opts.weight}" fill="${opts.color}" text-anchor="${align}">${tspans}</text>`;
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
export function compose(brief: GenerationBrief, approved: ApprovedText, visualDataUri: string | null): ComposedAsset {
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

  const parts: string[] = [];
  // Background: solid brand colour, then the AI visual on top (cover) when present.
  parts.push(`<rect width="${width}" height="${height}" fill="${bg}"/>`);
  if (visualDataUri) {
    parts.push(`<image href="${esc(visualDataUri)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`);
  }
  // Legibility scrim behind the text zone (bottom of tall/square, right column of wide).
  const scrim = L.headline;
  parts.push(
    `<rect x="0" y="${Math.max(0, scrim.y - height * 0.04).toFixed(1)}" width="${width}" height="${(height - Math.max(0, scrim.y - height * 0.04)).toFixed(1)}" fill="${bg}" opacity="0.55"/>`,
  );

  // Logo (top-left of safe box) - drawn as the brand image when we have a URL.
  if (hasLogo && L.logo && b.logoUrl) {
    parts.push(`<image href="${esc(b.logoUrl)}" x="${L.logo.x.toFixed(1)}" y="${L.logo.y.toFixed(1)}" width="${L.logo.w.toFixed(1)}" height="${L.logo.h.toFixed(1)}" preserveAspectRatio="xMinYMin meet"/>`);
  }

  parts.push(textBlock(approved.headline, L.headline, { color: ink, font: headFont, weight: 800, maxLines: 2 }));
  parts.push(textBlock(approved.subhead, L.subhead, { color: ink, font: bodyFont, weight: 400, maxLines: 2 }));
  if (hasOffer && L.offer && approved.offer) parts.push(pill(approved.offer, L.offer, accent, color(b.palette.background, "#ffffff"), headFont));
  parts.push(pill(approved.cta, L.cta, accent, color(b.palette.background, "#ffffff"), headFont));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
  return { formatId: format.id, width, height, svg };
}
