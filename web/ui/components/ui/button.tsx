import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@ui/lib/utils";

// Sketch buttons: 2px ink outline and a hard offset shadow that presses in on hover.
const sketch =
  "border-2 border-ink-line text-ink shadow-sketch hover:shadow-sketch-sm motion-safe:hover:translate-x-0.5 motion-safe:hover:translate-y-0.5 active:shadow-none motion-safe:active:translate-x-1 motion-safe:active:translate-y-1";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 font-bold tracking-[0.01em] whitespace-nowrap transition-[transform,box-shadow,background-color,color] duration-150 focus-visible:ring-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        contained: cn(sketch, "bg-sun hover:bg-[#fcd931]"),
        outlined: cn(sketch, "bg-white hover:bg-paper-warm"),
        blue: cn(sketch, "bg-sky hover:bg-[#cfe2fc]"),
        // A calm secondary action: outlined, no hard shadow.
        quiet: "border-2 border-ink/20 bg-white/90 text-ink hover:border-ink/50 hover:bg-white",
        text: "text-primary-500 underline-offset-4 hover:text-primary-700 hover:underline",
        link: "text-primary-500 underline decoration-2 decoration-sun underline-offset-4 hover:decoration-ink",
        ghost: "text-ink-muted hover:bg-ink/5 hover:text-ink",
        success: cn(sketch, "bg-mint hover:bg-[#cde4c4]"),
        destructive: cn(sketch, "bg-red-600 text-white hover:bg-red-700"),
      },
      size: {
        md: "h-10 rounded-[14px] px-4 text-sm",
        sm: "h-8 rounded-[10px] px-3 text-xs",
        icon: "size-9 rounded-[12px]",
      },
    },
    compoundVariants: [
      // Smaller buttons get a smaller hard shadow.
      { size: "sm", variant: ["contained", "outlined", "blue", "success", "destructive"], className: "shadow-[3px_3px_0_#0f172a] hover:shadow-sketch-sm" },
    ],
    defaultVariants: { variant: "contained", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
