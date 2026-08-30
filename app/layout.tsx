import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Telli type: Inter (the free match for telli's proprietary "Review").
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rahul-digital.vercel.app";
const TITLE = "AdBrain AI — Creative Decision Intelligence";
const DESCRIPTION =
  "Know what to test next, before you spend on it. AdBrain reads your Meta and Google ads and tells you what to scale, refresh, or kill, and why.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, url: SITE_URL, siteName: "AdBrain AI", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
