import { brandCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/brand-card";

// Twitter share-card = the same default card as og:image, so the summary_large_image card has a real preview
// (not just an og fallback). Config literals are declared here directly - Next must statically parse them, so
// they cannot be re-exported from another file.
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "AdScale — creative decision intelligence for Meta & Google ads";

export default function TwitterImage() {
  return brandCard("Meta & Google ads", "Know exactly what to change in your ads, and why");
}
