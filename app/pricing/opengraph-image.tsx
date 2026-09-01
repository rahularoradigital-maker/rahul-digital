import { brandCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/brand-card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "AdScale pricing";

export default function OgImage() {
  return brandCard("Pricing", "Simple, usage-based pricing for AdScale");
}
