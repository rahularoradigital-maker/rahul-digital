import { cn } from "@/lib/utils";

// A loading placeholder that matches the shape of the content it stands in for. Uses the app's surface-alt
// token so it reads as "loading", not as content, in both the light ground and inside cards.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // motion-safe: honour prefers-reduced-motion (no pulse for users who asked for less motion).
  return <div className={cn("motion-safe:animate-pulse rounded-md bg-[var(--surface-alt)]", className)} {...props} />;
}

export { Skeleton };
