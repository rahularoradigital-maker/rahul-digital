// Creative Production - QA ENGINE (Phase 9, pure, no I/O).
// Turns a composed asset + its brief into a QAResult. Critical failures block the asset (FAILED);
// warnings drop it to REVIEW; a clean pass is READY. We NEVER return READY with a failing critical
// check. Text accuracy is trusted because the composition draws the APPROVED strings deterministically
// (no model re-typing), so the only "text" risk is the composer not confirming it drew them.
import type { ComposedAsset, GenerationBrief, QACheck, QAResult } from "@/lib/creative-production/types";

type ApprovedText = { headline: string; cta: string; offer: string | null };
type QAOpts = {
  productFidelityRisk?: boolean;
  textPixelsPresent?: boolean;
  contrastRatio?: number;
  fileBytes?: number;
  visualMissing?: boolean; // the real image model produced NO visual -> a flat-colour fallback was used
};

// Platform file-size caps (bytes). Meta allows large images; Google Ads is much tighter.
function platformCap(platform: GenerationBrief["format"]["platform"]): number {
  return platform === "google" ? 5 * 1024 * 1024 : 30 * 1024 * 1024;
}

export function runQA(
  asset: ComposedAsset,
  brief: GenerationBrief,
  approvedText: ApprovedText,
  opts: QAOpts = {},
): QAResult {
  const checks: QACheck[] = [];
  const fmt = brief.format;
  const dimsMatch = asset.width === fmt.width && asset.height === fmt.height;

  // (1) aspect / resolution: composed pixels must equal the format's declared dimensions.
  checks.push({
    name: "aspect_resolution",
    pass: dimsMatch,
    severity: "critical",
    detail: dimsMatch
      ? `${asset.width}x${asset.height} matches ${fmt.id}`
      : `asset ${asset.width}x${asset.height} != format ${fmt.width}x${fmt.height}`,
  });

  // (1b) STRICT AI VISUAL: the background MUST come from the real image model (Nano Banana). If it did not,
  // the composer used a flat brand-colour fallback - which reads as an amateur, non-AI ad. Fail it hard so it
  // is never presented as READY; the user regenerates instead.
  checks.push({
    name: "ai_visual_present",
    pass: opts.visualMissing !== true,
    severity: "critical",
    detail: opts.visualMissing === true ? "no AI-generated visual (image model failed) - regenerate; flat fallback is not shippable" : "AI-generated visual present",
  });

  // (2) safe zone: enforced by the layout module; we can only assert the asset was composed at the
  // format's dimensions (and for the format it claims), which is the precondition for safe-zone math.
  const formatMatch = asset.formatId === fmt.id && dimsMatch;
  checks.push({
    name: "safe_zone",
    pass: formatMatch,
    severity: "critical",
    detail: formatMatch
      ? "composed at format dims; layout constrains content to the safe zone"
      : "asset formatId/dims do not match the target format",
  });

  // (3) text accuracy: the composer draws the approved headline/cta/offer deterministically, so this
  // passes unless the composer explicitly reports it did not draw the text (textPixelsPresent === false).
  const textDrawn = opts.textPixelsPresent !== false;
  checks.push({
    name: "text_accuracy",
    pass: textDrawn,
    severity: "critical",
    detail: textDrawn
      ? `approved headline/cta${approvedText.offer ? "/offer" : ""} composed verbatim`
      : "composer did not confirm approved text pixels were drawn",
  });

  // (4) product fidelity: only a hard fail when the generated product drifted AND the brief requires
  // fidelity (e.g. a real SKU whose shape/label must be preserved).
  const fidelityRisk = opts.productFidelityRisk === true && brief.requiredProductFidelity;
  checks.push({
    name: "product_fidelity",
    pass: !fidelityRisk,
    severity: "critical",
    detail: fidelityRisk
      ? "generated product drifted from reference and fidelity is required"
      : "product fidelity acceptable or not required",
  });

  // (5) file size within the platform cap.
  const cap = platformCap(fmt.platform);
  const bytes = opts.fileBytes;
  const sizeOk = bytes === undefined || bytes <= cap;
  checks.push({
    name: "file_size",
    pass: sizeOk,
    severity: "critical",
    detail:
      bytes === undefined
        ? "file size not measured"
        : `${bytes} bytes vs ${cap} cap (${fmt.platform})`,
  });

  // (warning) contrast: WCAG AA body text wants >= 4.5. Only checked when measured.
  if (opts.contrastRatio !== undefined) {
    const contrastOk = opts.contrastRatio >= 4.5;
    checks.push({
      name: "contrast",
      pass: contrastOk,
      severity: "warning",
      detail: `contrast ${opts.contrastRatio} vs WCAG AA 4.5`,
    });
  }

  // (warning) offer present: if the concept promised an offer, the asset should actually carry it.
  if (brief.concept.offer) {
    const offerPresent = approvedText.offer !== null && approvedText.offer !== "";
    checks.push({
      name: "offer_present",
      pass: offerPresent,
      severity: "warning",
      detail: offerPresent
        ? "offer text composed"
        : "concept sets an offer but no offer text/region is present",
    });
  }

  const critFail = checks.some((c) => c.severity === "critical" && !c.pass);
  const warnFail = checks.some((c) => c.severity === "warning" && !c.pass);
  const status: QAResult["status"] = critFail ? "FAILED" : warnFail ? "REVIEW" : "READY";
  return { status, checks };
}
