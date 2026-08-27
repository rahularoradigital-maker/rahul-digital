import { GatedSection } from "@/components/app/gated-section";

// Brand Brain. Needs the creative decoder (DECODE + FPRINT, rulebook 2.1) that is not
// built yet, so this is honestly gated: no fabricated hooks, angles, or personas.

export function BrandBrainSection() {
  return (
    <GatedSection
      title="Brand Brain"
      what="A living memory of what wins for your brand: the hooks, angles, personas, formats and offers your best ads share, learned by decoding every creative."
      delivers={[
        "Your winning hooks and angles, ranked",
        "Which formats hold up longest before fatigue",
        "Personas and offers that repeat across winners",
      ]}
      needs="the creative decoder (Google Vision plus video frames and transcripts), coming next"
    />
  );
}
