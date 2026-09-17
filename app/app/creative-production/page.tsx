import { StudioLoader } from "@/components/app/creative-production/studio-loader";

// Creative Studio: Shopify -> product understanding -> ranked concepts -> AI static-ad generation -> QA ->
// human review -> export. Isolated Creative Production module; nothing else in AdScale depends on it.
// The ~1000-line studio is code-split + deferred via StudioLoader (next/dynamic) so it does not weigh down
// the initial load; the page shell + heading paint immediately, the studio hydrates with a skeleton.
export const maxDuration = 300;

export default function CreativeProductionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-normal tracking-tight">Creative Studio</h1>
      <StudioLoader />
    </div>
  );
}
