import ProductThemed from "@/components/marketing/product-themed";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://adscaledigital.co";

// Page-specific metadata: /product previously inherited only the site-wide title, so it had no unique title,
// description, or canonical - a real on-page SEO gap on a key page. Preserved through the re-theme.
export const metadata = {
  title: "The AdScale AI Platform — Meta & Google ad decisions",
  description:
    "AdScale connects to your Meta and Google ad accounts and hands your team a ranked, reasoned decision on what to scale, refresh, or kill - with the why behind every call.",
  alternates: { canonical: "/product" },
  openGraph: {
    type: "website",
    title: "The AdScale AI Platform — Meta & Google ad decisions",
    description:
      "AdScale reads your ad accounts and tells you what to scale, refresh, or kill, with a reason for every call.",
    url: `${SITE_URL}/product`,
    siteName: "AdScale AI",
  },
};

// Enriches the SAME SoftwareApplication entity declared site-wide (shared @id -> engines merge, no duplicate).
// This node ONLY ADDS featureList: name/url/description/category live on the site-wide node, so restating them
// here (with a page-specific url) would give one @id conflicting single-value fields. Honest only: no
// offers/price or aggregateRating - we have no real pricing or reviews to substantiate.
const PRODUCT_JSON_LD = JSON.stringify([
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}#software`,
    featureList: [
      "Reads Meta and Google ad accounts",
      "Recommends scale, refresh, or kill with a reason for every call",
      "Checks whether a metric has enough spend to be trusted",
      "Flags creative fatigue and delivery issues",
      "Never edits, pauses, or spends on your account",
      "Works across multiple ad accounts",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Platform", item: `${SITE_URL}/product` },
    ],
  },
]);

export default function ProductPage() {
  return (
    <>
      <script type="application/ld+json">{PRODUCT_JSON_LD}</script>
      <ProductThemed />
    </>
  );
}
