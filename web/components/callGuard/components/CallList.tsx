"use client";

import { Loader2, TriangleAlert } from "lucide-react";

import { Badge } from "@ui/components/ui/badge";
import { cn } from "@ui/lib/utils";

import { CATEGORY, lastAiLanguage, timeAgo } from "../callGuard.constants";
import type { Call } from "../callGuard.types";
import { LanguagePill, PriorityBadge, RiskPill, VipStar } from "./GuardBadges";

function StatusLine({ call }: { call: Call }) {
  if (call.status === "running") return <span className="flex items-center gap-1.5 text-ink"><span className="size-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />On call…</span>;
  if (call.status === "triaging") return <span className="flex items-center gap-1.5 text-ink"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Writing summary…</span>;
  return <span className="flex items-center gap-1.5 text-red-700"><TriangleAlert className="size-3.5" aria-hidden="true" />Couldn&apos;t screen this call</span>;
}

function CallRow({ call, selected, onSelect }: { call: Call; selected: boolean; onSelect: () => void }) {
  const triage = call.triage;
  const done = call.status === "done" && triage;
  const language = lastAiLanguage(call.transcript);
  return (
    <li>
      <button type="button" onClick={onSelect} aria-current={selected ? "true" : undefined} className={cn("flex w-full cursor-pointer flex-col gap-1.5 rounded-2xl border-2 bg-white px-4 py-3 text-left transition-[border-color,box-shadow] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink", selected ? "border-ink shadow-sketch-sm" : "border-ink/10 hover:border-ink/40", triage?.priority === "blocked" && "bg-rose-light/50")}>
        <span className="flex w-full items-start justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {done ? <PriorityBadge priority={triage.priority} /> : null}
            <span className="truncate text-sm font-bold text-ink">{triage?.callerName || call.scenarioTitle || "Unknown caller"}</span>
            {triage?.vip && <VipStar />}
          </span>
          <span className="shrink-0 text-xs text-secondary-text">{timeAgo(call.createdAt)}</span>
        </span>
        <span className="line-clamp-1 text-sm text-[#334155]">{done ? triage.purpose : <StatusLine call={call} />}</span>
        {done && (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge>{CATEGORY[triage.category]}</Badge>
            <RiskPill risk={triage.scamRisk} />
            {language && <LanguagePill language={language} />}
          </span>
        )}
      </button>
    </li>
  );
}

export function CallList({ calls, selectedId, onSelect }: { calls: Call[]; selectedId: string | null; onSelect: (callId: string) => void }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {calls.map((call) => <CallRow key={call.id} call={call} selected={call.id === selectedId} onSelect={() => onSelect(call.id)} />)}
    </ul>
  );
}
