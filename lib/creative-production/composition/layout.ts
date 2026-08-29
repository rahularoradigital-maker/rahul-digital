// Creative Production - COMPOSITION GEOMETRY (Phase 8, pure, no I/O).
// This module decides WHERE each element sits inside a given AdFormat and how to center-crop a
// generated image into a target aspect ratio. The actual raster render (drawing pixels, fonts,
// PNG encode) is a SEPARATE module - here we only compute rectangles in format pixels.
//
// Invariants every layout must hold:
//  - safeBox = the format inset by its safeZone fractions. All text/logo/product sit inside safeBox.
//  - headline and cta never overlap (product MAY sit behind text).
//  - layout is deterministic and respects the aspect-ratio family (tall / square / wide).
import type { AdFormat } from "@/lib/creative-production/types";

export type Region = { x: number; y: number; w: number; h: number };

type LayoutOpts = { hasOffer: boolean; hasLogo: boolean };
type Layout = {
  productBox: Region;
  headline: Region;
  subhead: Region;
  cta: Region;
  logo: Region | null;
  offer: Region | null;
  safeBox: Region;
};

// The usable canvas: format inset by its per-edge safeZone fractions. For 9:16 the huge top/bottom
// insets make this a narrow central band, which is exactly what "keep everything in the band" means.
function safeBoxFor(format: AdFormat): Region {
  const { width, height, safeZone } = format;
  return {
    x: width * safeZone.left,
    y: height * safeZone.top,
    w: width * (1 - safeZone.left - safeZone.right),
    h: height * (1 - safeZone.top - safeZone.bottom),
  };
}

export function layoutFor(format: AdFormat, opts: LayoutOpts): Layout {
  const safeBox = safeBoxFor(format);
  const { x: sx, y: sy, w: sw, h: sh } = safeBox;
  const ratio = format.width / format.height;
  const pad = Math.min(sw, sh) * 0.03;

  // Logo (when present) pins to the top-left of the safe box.
  const logo: Region | null = opts.hasLogo
    ? { x: sx, y: sy, w: Math.min(sw * 0.25, sh * 0.12), h: sh * 0.08 }
    : null;

  let productBox: Region;
  let headline: Region;
  let subhead: Region;
  let cta: Region;
  let offer: Region | null;

  if (ratio >= 1.5) {
    // WIDE family (1.91:1): product occupies the left column, text stacks in the right column.
    productBox = { x: sx, y: sy, w: sw * 0.46, h: sh };
    const tx = sx + sw * 0.5;
    const tw = sw * 0.5;
    headline = { x: tx, y: sy + sh * 0.1, w: tw, h: sh * 0.28 };
    subhead = { x: tx, y: sy + sh * 0.42, w: tw, h: sh * 0.18 };
    offer = opts.hasOffer ? { x: tx, y: sy + sh * 0.62, w: tw, h: sh * 0.14 } : null;
    cta = { x: tx, y: sy + sh * 0.8, w: tw * 0.6, h: sh * 0.16 };
  } else {
    // TALL (9:16) and SQUARE/PORTRAIT (1:1, 4:5) families share a vertical rhythm:
    // product occupies the upper region, text stacks in the lower region of the safe box.
    // Tall formats center the product band a touch lower so it reads inside the narrow safe band.
    const tall = ratio <= 0.65;
    const logoH = logo ? logo.h + pad : 0;
    const productTop = sy + logoH + (tall ? sh * 0.06 : 0);
    const productBottom = sy + sh * (tall ? 0.5 : 0.52);
    productBox = { x: sx, y: productTop, w: sw, h: productBottom - productTop };

    const ty = sy + sh * 0.56; // top of the text zone (lower ~44% of the safe box)
    headline = { x: sx, y: ty, w: sw, h: sh * 0.14 };
    subhead = { x: sx, y: ty + sh * 0.15, w: sw, h: sh * 0.09 };
    offer = opts.hasOffer ? { x: sx, y: ty + sh * 0.25, w: sw, h: sh * 0.07 } : null;
    cta = { x: sx + sw * 0.2, y: ty + sh * 0.34, w: sw * 0.6, h: sh * 0.1 };
  }

  return { productBox, headline, subhead, cta, logo, offer, safeBox };
}

// Center-crop math: fit a target ratio (targetRatioW:targetRatioH) inside a source image WITHOUT
// distortion, by cropping the overflowing axis symmetrically. Returns the crop rect in source px.
export function cropRegion(
  sourceW: number,
  sourceH: number,
  targetRatioW: number,
  targetRatioH: number,
): Region {
  const targetRatio = targetRatioW / targetRatioH;
  const sourceRatio = sourceW / sourceH;
  let w: number;
  let h: number;
  if (sourceRatio > targetRatio) {
    // Source is too wide for the target: keep full height, crop the sides.
    h = sourceH;
    w = h * targetRatio;
  } else {
    // Source is too tall for the target: keep full width, crop top/bottom.
    w = sourceW;
    h = w / targetRatio;
  }
  return { x: (sourceW - w) / 2, y: (sourceH - h) / 2, w, h };
}
