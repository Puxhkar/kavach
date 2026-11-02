import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@ui/lib/utils";

// Display headings are serif with tight tracking; everything else is the sans UI face.
const typographyVariants = cva("", {
  variants: {
    size: {
      heading1: "font-serif text-4xl leading-[1.05] tracking-[-0.035em] sm:text-5xl",
      heading2: "font-serif text-3xl leading-[1.08] tracking-[-0.03em] sm:text-4xl",
      heading3: "font-serif text-2xl leading-tight tracking-[-0.025em]",
      heading4: "text-base leading-snug tracking-[-0.01em]",
      paragraph1: "text-base leading-relaxed",
      paragraph2: "text-sm leading-relaxed",
      paragraph3: "text-xs leading-relaxed",
      caption: "text-xs leading-normal",
    },
    fontWeight: {
      bold: "font-semibold",
      semiBold: "font-medium",
      normal: "font-normal",
    },
    textAlign: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
    tone: {
      default: "text-ink",
      muted: "text-secondary-text",
      error: "text-red-700",
      inherit: "",
    },
  },
  compoundVariants: [
    // The sans card titles read best a touch heavier.
    { size: "heading4", fontWeight: "bold", className: "font-bold" },
  ],
  defaultVariants: { size: "paragraph2", fontWeight: "normal", tone: "default" },
});

type TypographyTag = "p" | "span" | "h1" | "h2" | "h3" | "h4" | "label" | "div";

type TypographyProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof typographyVariants> & { as?: TypographyTag; htmlFor?: string };

function Typography({
  as: Tag = "p",
  className,
  size,
  fontWeight,
  textAlign,
  tone,
  ...props
}: TypographyProps) {
  return (
    <Tag
      className={cn(typographyVariants({ size, fontWeight, textAlign, tone }), className)}
      {...props}
    />
  );
}

export { Typography, typographyVariants };
