import { PageSkeleton } from "@/components/app/page-skeleton";
// Instant loader while this page fetches on the server (see components/app/page-skeleton).
export default function Loading() {
  return <PageSkeleton />;
}
