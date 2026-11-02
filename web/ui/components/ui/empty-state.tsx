import * as React from "react";

import { cn } from "@ui/lib/utils";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "empty" | "error";
  className?: string;
};

// A dashed paper box, like a blank page in a notebook.
function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "empty",
  className,
}: EmptyStateProps) {
  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={cn(
        "empty-paper flex flex-col items-center gap-3 px-6 py-12 text-center",
        variant === "error" && "border-red-300 bg-rose-light/60",
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            "grid size-12 rotate-[-4deg] place-items-center rounded-2xl border-2 border-ink shadow-sketch-sm motion-reduce:rotate-0",
            variant === "error" ? "bg-rose text-red-800" : "bg-sun text-ink",
          )}
        >
          {icon}
        </div>
      )}
      <p className="font-serif text-xl font-semibold tracking-tight text-ink">{title}</p>
      {description && <p className="max-w-md text-sm leading-6 text-secondary-text">{description}</p>}
      {action}
    </div>
  );
}

export { EmptyState };
