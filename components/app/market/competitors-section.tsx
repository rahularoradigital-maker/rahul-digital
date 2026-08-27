import { GatedSection } from "@/components/app/gated-section";

// Competitor intelligence (rulebook 5.3 message-gap, 5.5 creative mix vs competitor).
// Needs a competitor Ad Library ingest we do not have yet, so this is honestly gated:
// no fabricated gap scores or mix charts until that source is connected.

export function CompetitorsSection() {
  return (
    <GatedSection
      title="Competitor intelligence"
      what="Decode every rival's live ads from the public Meta Ad Library to find the messages and formats they own and the whitespace they leave open."
      delivers={[
        "Message gaps: motivators the market wants that you are absent on",
        "Creative mix vs competitors (format and funnel split)",
        "A copying alarm when a hook you owned goes category-common",
      ]}
      needs="Competitor Ad Library ingest (paste rival Ad Library URLs)"
    />
  );
}
