import { Check } from "lucide-react";
import Link from "next/link";

import { cn } from "@ui/lib/utils";

import { SETUP_STEPS, agentRoute } from "../agentTesting.constants";
import type { SetupPageStep, SetupProgress } from "../agentTesting.types";

type SetupStepperProps = {
  current: SetupPageStep;
  /** null while the agent does not exist yet (the New agent page). */
  progress: SetupProgress | null;
  agentId?: string;
};

function isDone(step: SetupPageStep, progress: SetupProgress | null) {
  if (!progress) return false;
  if (step === "connect") return progress.connectDone;
  if (step === "describe") return progress.describeDone;
  return false;
}

export default function SetupStepper({ current, progress, agentId }: SetupStepperProps) {
  return (
    <nav aria-label="Setup steps">
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SETUP_STEPS.map((step, i) => {
          const done = isDone(step.id, progress);
          const active = step.id === current;
          const reachable =
            !!agentId && step.available && (step.id === "connect" || (progress?.connectDone ?? false));
          const body = (
            <>
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-bold tabular-nums",
                  done && "bg-ink text-white",
                  !done && active && "bg-sun text-ink shadow-sketch-sm",
                  !done && !active && "bg-white text-ink",
                )}
                aria-hidden="true"
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={cn("truncate text-sm", active ? "font-bold text-ink" : "font-semibold text-ink/80")}>
                  {step.label}
                </span>
                <span className="truncate text-xs text-secondary-text">
                  {step.available ? step.description : "Next build phase"}
                </span>
              </span>
            </>
          );
          const className = cn(
            "flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5",
            active ? "yellow-paper border-ink shadow-tile" : "border-ink/12 bg-white/80",
            !step.available && "opacity-60",
          );
          return (
            <li key={step.id}>
              {reachable && agentId ? (
                <Link
                  href={agentRoute(agentId, step.id)}
                  aria-current={active ? "step" : undefined}
                  className={cn(className, "transition-colors hover:border-ink/40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink")}
                >
                  {body}
                </Link>
              ) : (
                <div aria-current={active ? "step" : undefined} className={className}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
