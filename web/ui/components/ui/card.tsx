import * as React from "react";

import { cn } from "@ui/lib/utils";

// Paper cards: 2px ink outline, big radius, a soft offset shadow and a gentle paper gradient.
const TONES = {
  plain: "bg-white",
  paper: "paper-card",
  yellow: "yellow-paper",
  blue: "blueprint-card",
  rose: "rose-paper",
  mint: "mint-paper",
} as const;

type CardProps = React.ComponentProps<"section"> & {
  tone?: keyof typeof TONES;
  /** A dashed "tape strip" stuck on the top-right corner. */
  tape?: boolean;
};

function Card({ className, tone = "paper", tape = false, ...props }: CardProps) {
  return (
    <section
      data-slot="card"
      className={cn(
        "relative rounded-3xl border-2 border-ink text-ink shadow-board",
        TONES[tone],
        tape && "tape",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b-2 border-dashed border-ink/12 px-5 py-4 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-5 py-4 sm:px-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex flex-wrap items-center justify-end gap-3 border-t-2 border-dashed border-ink/12 px-5 py-3 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardContent, CardFooter, CardHeader };
