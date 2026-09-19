import type { Metadata } from "next";
import BookDemoThemed from "@/components/marketing/book-demo-themed";

// SEO (Phase-0 audit): the primary conversion page had NO metadata export, so it inherited the root's
// title/description and a canonical of "/" - Google read it as a duplicate of the homepage.
export const metadata: Metadata = {
  title: "Book a demo - AdScale",
  description: "See AdScale on your own Meta ad account: a live plan of what to scale, refresh, or pause. Founder-led, no slideware.",
  alternates: { canonical: "/book-demo" },
};

export default async function BookDemoPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return <BookDemoThemed initialEmail={typeof email === "string" ? email : ""} />;
}
