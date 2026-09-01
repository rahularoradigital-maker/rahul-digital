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
  alternates: { canonical: "/" },
  icons: { icon: "/icon.svg" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: SITE_URL, siteName: "AdBrain AI", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

// Site-wide entity signals (spec section 26/27): one consistent brand identity for search + answer engines.
// Honest only - no reviews, ratings, prices, or awards we cannot substantiate. SoftwareApplication describes
// what AdBrain actually is; Organization + WebSite establish the entity. Content is a static developer-authored
// constant (no user input), rendered as script text children - safe for application/ld+json.
// Stable @id anchors so nodes across pages resolve to ONE entity: /product enriches the same
// SoftwareApplication (#software) instead of declaring a duplicate, and everything can reference #organization.
const JSON_LD = JSON.stringify([
  { "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE_URL}#organization`, name: "AdBrain AI", url: SITE_URL, logo: `${SITE_URL}/icon.svg`, description: DESCRIPTION },
  { "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE_URL}#website`, name: "AdBrain AI", url: SITE_URL, publisher: { "@id": `${SITE_URL}#organization` } },
  { "@context": "https://schema.org", "@type": "SoftwareApplication", "@id": `${SITE_URL}#software`, name: "AdBrain AI", applicationCategory: "BusinessApplication", operatingSystem: "Web", url: SITE_URL, description: DESCRIPTION, publisher: { "@id": `${SITE_URL}#organization` } },
]);

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <script type="application/ld+json">{JSON_LD}</script>
        {children}
      </body>
    </html>
  );
}
