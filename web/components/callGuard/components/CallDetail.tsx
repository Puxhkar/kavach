"use client";

import { AlertCircle, CalendarClock, Lightbulb, Loader2, ShieldAlert, TriangleAlert } from "lucide-react";

import { Badge } from "@ui/components/ui/badge";
import { Button } from "@ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@ui/components/ui/card";
import { EmptyState } from "@ui/components/ui/empty-state";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Typography } from "@ui/components/ui/typography";

import { CATEGORY, formatDuration, lastAiLanguage, timeAgo } from "../callGuard.constants";
import { callRecordingUrl } from "../callGuard.service";
import type { Call, Triage } from "../callGuard.types";
import { useGetCall } from "../hooks/useCalls";
import ConversationPlayback from "./ConversationPlayback";
import { LanguagePill, PriorityBadge, RiskBar, VipStar } from "./GuardBadges";

function TriageCard({ triage }: { triage: Triage }) {
  return (
    <Card tone="yellow">
      <CardContent className="flex flex-col gap-4 py-5">
        <span className="panel-title">Summary</span>
        <Typography size="paragraph1" className="-mt-2 leading-7">{triage.summary}</Typography>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="note-box flex gap-2.5 bg-white/85 p-3.5">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="panel-title text-[11px]">Suggested action</span>
              <span className="text-sm leading-6 text-ink">{triage.action || "Nothing to do."}</span>
            </div>
          </div>
          <div className="note-box flex gap-2.5 bg-white/85 p-3.5">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-secondary-text" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="panel-title text-[11px]">Callback promised</span>
              <span className="text-sm leading-6 text-ink">{triage.callback || "No callback promised."}</span>
            </div>
          </div>
        </div>
        {triage.redFlags.length > 0 && (
          <div className="note-box flex flex-col gap-2 border-red-200 bg-rose-light/80 p-3.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-red-800"><ShieldAlert className="size-4" aria-hidden="true" />Red flags</span>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-red-900">
              {triage.redFlags.map((flag) => <li key={flag}>{flag}</li>)}
            </ul>
          </div>
        )}
        <RiskBar risk={triage.scamRisk} />
      </CardContent>
    </Card>
  );
}

function CallHeader({ call }: { call: Call }) {
  const triage = call.triage;
  const spokeIn = lastAiLanguage(call.transcript);
  const meta = [timeAgo(call.createdAt), call.source === "live" ? "Live call" : `Simulated · ${call.scenarioTitle}`, call.language ? `Greeted in ${call.language}` : null, call.durationMs > 0 ? formatDuration(call.durationMs) : null].filter(Boolean).join(" · ");
  return (
    <Card tone="plain">
      <CardHeader className="border-b-0 py-5">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Typography as="h2" size="heading3" fontWeight="bold" className="break-words">{triage?.callerName || call.scenarioTitle || "Unknown caller"}</Typography>
            {triage?.vip && <VipStar />}
          </div>
          {triage?.organisation && <Typography size="paragraph2" tone="muted">{triage.organisation}</Typography>}
          {triage?.purpose && <Typography size="paragraph2" className="text-[#334155]">{triage.purpose}</Typography>}
          <Typography size="caption" tone="muted">{meta}</Typography>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {triage && <PriorityBadge priority={triage.priority} className="px-2.5 py-1 text-sm" />}
          {triage && <Badge className="px-2.5 py-1 text-sm">{CATEGORY[triage.category]}</Badge>}
          {spokeIn && <LanguagePill language={spokeIn} prefix="Spoke in: " className="px-2.5 py-1 text-sm" />}
        </div>
      </CardHeader>
    </Card>
  );
}

export default function CallDetail({ callId }: { callId: string }) {
  const { data: call, isPending, error, refetch } = useGetCall(callId);

  if (isPending) return <div className="flex flex-col gap-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!call) return <EmptyState variant="error" icon={<AlertCircle className="size-5" aria-hidden="true" />} title="Couldn't load this call" description={error?.message} action={<Button variant="outlined" onClick={() => void refetch()}>Try again</Button>} />;

  return (
    <div className="flex flex-col gap-5">
      <CallHeader call={call} />
      {call.status === "error" ? (
        <div role="alert" className="note-box flex gap-3 border-red-200 bg-rose-light/80 p-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <Typography fontWeight="semiBold" tone="inherit" className="text-red-900">The assistant couldn&apos;t screen this call</Typography>
            <Typography size="paragraph3" tone="inherit" className="text-red-800">{call.error || "Something went wrong during the call."}</Typography>
          </div>
        </div>
      ) : call.triage ? (
        <TriageCard triage={call.triage} />
      ) : (
        <Card tone="yellow">
          <CardContent className="flex flex-col gap-3 py-5">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {call.status === "running" ? "On call… the assistant is talking to the caller." : "Writing summary…"}
            </span>
            <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><Typography as="h3" size="heading4" fontWeight="bold">Recording &amp; transcript</Typography>{call.hasRecording && <span className="text-xs text-secondary-text">Tap a time to play from that line</span>}</CardHeader>
        <CardContent>
          <ConversationPlayback transcript={call.transcript} recordingSrc={call.hasRecording ? callRecordingUrl(call.id) : null} durationMs={call.durationMs} aiLabel="Assistant" personLabel="Caller" heardLabel="Assistant heard" live={call.status === "running"} liveText="On call…" />
        </CardContent>
      </Card>
    </div>
  );
}
