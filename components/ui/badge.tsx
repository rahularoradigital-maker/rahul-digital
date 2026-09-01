import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-[var(--good-bg)] text-[var(--good-ink)]",
        warning: "border-transparent bg-[var(--warn-bg)] text-[var(--warn-ink)]",
        muted: "border-transparent bg-secondary text-muted-foreground",
        accent: "border-transparent bg-[var(--accent-soft)] text-[var(--accent)]",
        destructive: "border-transparent bg-[var(--bad-bg)] text-[var(--bad-ink)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
