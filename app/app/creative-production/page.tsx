import { CreativeStudio } from "@/components/app/creative-production/studio";

// Creative Studio: Shopify -> product understanding -> ranked concepts -> AI static-ad generation -> QA ->
// human review -> export. Isolated Creative Production module; nothing else in AdBrain depends on it.
export const maxDuration = 300;

export default function CreativeProductionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-normal tracking-tight">Creative Studio</h1>
      <CreativeStudio />
    </div>
  );
}
