import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Telli type: Inter (the free match for telli's proprietary "Review").
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "AdBrain AI — Creative Decision Intelligence",
  description:
    "Know what to test next, before you spend on it. AdBrain reads your Meta and Google ads and tells you what to scale, refresh, or kill, and why.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
