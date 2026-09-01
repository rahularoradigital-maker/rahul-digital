import { brandCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/brand-card";

export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "AdScale product — what to change in your Meta & Google ads";

export default function OgImage() {
  return brandCard("Product", "One cockpit for every Meta & Google ad decision");
}
