import { redirect } from "next/navigation";

// Consolidated: the Influencer Hunt experience now lives at /app/creators (the shadcn build with filters).
// This route redirects so any old link keeps working.
export default function InfluencerRedirect() {
  redirect("/app/creators");
}
