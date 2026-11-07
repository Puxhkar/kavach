import { Languages, Star } from "lucide-react";

import { Badge } from "@ui/components/ui/badge";
import { cn } from "@ui/lib/utils";

import { OUTCOME, PRIORITY, riskTone, VERDICT } from "../callGuard.constants";
import type { DrillVerdict, ErrandOutcome, Priority } from "../callGuard.types";

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const meta = PRIORITY[priority];
  return <Badge className={cn(meta.className, className)}>{meta.label}</Badge>;
}

export function RiskPill({ risk }: { risk: number }) {
  return <Badge className={riskTone(risk).pill}>Scam risk {risk}%</Badge>;
}

export function VerdictBadge({ verdict, className }: { verdict: DrillVerdict; className?: string }) {
  const meta = VERDICT[verdict];
  return <Badge className={cn(meta.className, className)}>{meta.label}</Badge>;
}

export function OutcomeBadge({ outcome, className }: { outcome: ErrandOutcome; className?: string }) {
  const meta = OUTCOME[outcome];
  return <Badge className={cn(meta.className, className)}>{meta.label}</Badge>;
}

/** A language tag. `detected`: what speech recognition heard the person speak ("Detected: Kannada"). */
export function LanguagePill({ language, detected = false, prefix, className }: { language: string; detected?: boolean; prefix?: string; className?: string }) {
  return (
    <Badge className={cn("gap-1 border-violet-300 bg-violet-50 px-2 text-[11px] text-violet-800", className)} title={detected ? "Language detected by Gnani speech recognition" : undefined}>
      <Languages className="size-3 shrink-0" aria-hidden="true" />
      {prefix ?? (detected ? "Detected: " : "")}{language}
    </Badge>
  );
}

/** A thin row marking the moment the AI changed language. Render it before that AI line. */
export function LanguageSwitchDivider({ language }: { language: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-violet-800" role="note">
      <span className="h-0 flex-1 border-t-2 border-dashed border-violet-200" aria-hidden="true" />
      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5"><Languages className="size-3.5" aria-hidden="true" />Switched to {language}</span>
      <span className="h-0 flex-1 border-t-2 border-dashed border-violet-200" aria-hidden="true" />
    </div>
  );
}

export function VipStar() {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600" title="VIP contact">
      <Star className="size-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
      <span className="sr-only">VIP</span>
    </span>
  );
}

/** A 0–100 scam risk bar with its number. */
export function RiskBar({ risk }: { risk: number }) {
  const tone = riskTone(risk);
  const value = Math.max(0, Math.min(100, risk));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Scam risk</span>
        <span className={cn("text-sm font-bold", tone.text)}>{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-white" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Scam risk">
        <div className={cn("h-full transition-[width]", tone.bar)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
