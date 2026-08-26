import { GatedSection } from "@/components/app/gated-section";

// Voice of Customer. Needs a connected reviews or support source we do not have yet,
// so this is honestly gated: no fabricated motivators or objections until then.

export default function VoiceOfCustomerPage() {
  return (
    <GatedSection
      title="Voice of Customer"
      what="Mine your customers' own words - reviews, comments, support - for the angles and objections that convert."
      delivers={[
        "Top buying motivators in customer language",
        "Objections to handle in creative",
        "Angles ranked by how often customers raise them",
      ]}
      needs="a connected reviews or support source"
    />
  );
}
