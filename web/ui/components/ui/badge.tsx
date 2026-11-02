import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@ui/lib/utils";

// Pills with a thin outline; text is always a dark shade of the fill so it stays readable.
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-ink/15 bg-white text-ink",
        primary: "border-blue-300 bg-sky text-blue-900",
        success: "border-emerald-300 bg-mint text-emerald-900",
        warning: "border-amber-300 bg-amber-50 text-amber-900",
        danger: "border-red-300 bg-rose-light text-red-800",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
