"use client";

import { AlertCircle, Check, Copy, Lightbulb, Loader2, MessageCircle, RotateCcw, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@ui/components/ui/badge";
import { Button, buttonVariants } from "@ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@ui/components/ui/card";
import { EmptyState } from "@ui/components/ui/empty-state";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";

import { CALL_GUARD_DRILL_ROUTE, formatDuration, timeAgo } from "../callGuard.constants";
import { drillRecordingUrl } from "../callGuard.service";
import type { Drill, DrillResult } from "../callGuard.types";
import { isCallActive } from "../hooks/useCalls";
import { useGetDrill } from "../hooks/useDrills";
import ConversationPlayback from "./ConversationPlayback";
import { VerdictBadge } from "./GuardBadges";

const SCORE_RING = { safe: "border-emerald-500 text-emerald-800", at_risk: "border-amber-500 text-amber-800", scammed: "border-red-500 text-red-700" } as const;

function ScoreCard({ drill, result }: { drill: Drill; result: DrillResult }) {
  return (
    <Card tone="yellow">
      <CardContent className="flex flex-col items-center gap-6 py-7 sm:flex-row sm:items-center">
        <div className={cn("grid size-32 shrink-0 place-items-center rounded-full border-[10px] bg-white shadow-[0_0_0_2px_#10213a,5px_5px_0_2px_#10213a]", SCORE_RING[result.verdict])}>
          <span className="flex flex-col items-center leading-none"><span className="text-4xl font-bold">{result.score}</span><span className="mt-1 text-xs font-medium text-secondary-text">out of 100</span></span>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
          <VerdictBadge verdict={result.verdict} className="px-3 py-1 text-sm" />
          <Typography as="h2" size="heading3" fontWeight="bold">{drill.practicerName || "You"} vs. {drill.scamTitle}</Typography>
          <Typography size="paragraph3" tone="muted">{[timeAgo(drill.createdAt), drill.language, drill.durationMs > 0 ? formatDuration(drill.durationMs) : null, drill.hungUp ? "Hung up on the scammer" : null].filter(Boolean).join(" · ")}</Typography>
        </div>
      </CardContent>
    </Card>
  );
}

function FamilyMessage({ message }: { message: string }) {
  const copy = () =>
    navigator.clipboard.writeText(message).then(
      () => toast.success("Copied. Paste it in your family chat."),
      () => toast.error("Couldn't copy. Select the text and copy it instead."),
    );
  return (
    <Card tone="mint">
      <CardHeader><div className="flex flex-col gap-0.5"><Typography as="h3" size="heading4" fontWeight="bold">Message for the family</Typography><Typography size="paragraph3" tone="muted">Share how the drill went.</Typography></div></CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="note-box bg-white/85 p-3.5 text-sm leading-6 break-words whitespace-pre-wrap text-ink">{message}</p>
        <div className="flex flex-wrap gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "success" })}><MessageCircle aria-hidden="true" />Share on WhatsApp</a>
          <Button variant="quiet" onClick={() => void copy()}><Copy aria-hidden="true" />Copy</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultBody({ drill, result }: { drill: Drill; result: DrillResult }) {
  const checks = [...result.checks].sort((a, b) => Number(a.passed) - Number(b.passed));
  return (
    <>
      <ScoreCard drill={drill} result={result} />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card tone="plain">
          <CardHeader><Typography as="h3" size="heading4" fontWeight="bold">How you did</Typography></CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {checks.map((check) => (
                <li key={check.name} className="flex items-start gap-3">
                  <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2", check.passed ? "border-emerald-600 bg-mint text-emerald-800" : "border-red-600 bg-rose-light text-red-700")}>
                    {check.passed ? <Check className="size-3.5" aria-label="Passed" /> : <X className="size-3.5" aria-label="Missed" />}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink">{check.name}{check.critical && <Badge variant="danger">Critical</Badge>}</span>
                    {check.detail && <span className="text-sm leading-6 text-secondary-text">{check.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          {result.tips.length > 0 && (
            <Card>
              <CardHeader><Typography as="h3" size="heading4" fontWeight="bold">Tips for next time</Typography><Lightbulb className="size-5 text-amber-500" aria-hidden="true" /></CardHeader>
              <CardContent>
                <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-[#334155] marker:text-amber-500">{result.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
              </CardContent>
            </Card>
          )}
          {result.familyMessage && <FamilyMessage message={result.familyMessage} />}
        </div>
      </div>
    </>
  );
}

export default function DrillResultView({ drillId }: { drillId: string }) {
  const { data: drill, isPending, error, refetch } = useGetDrill(drillId);

  if (isPending) return <div className="flex flex-col gap-4"><Skeleton className="h-44 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!drill) return <EmptyState variant="error" icon={<AlertCircle className="size-5" aria-hidden="true" />} title="Couldn't load this drill" description={error?.message} action={<Button variant="outlined" onClick={() => void refetch()}>Try again</Button>} />;

  const active = isCallActive(drill.status);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="panel-title">Drill result</span>
        <Link href={CALL_GUARD_DRILL_ROUTE} className={buttonVariants({ variant: "contained", size: "sm" })}><RotateCcw aria-hidden="true" />Practise again</Link>
      </div>
      {active ? (
        <Card tone="yellow"><CardContent className="flex flex-col items-center gap-3 py-10 text-center"><Loader2 className="size-8 animate-spin text-ink" aria-hidden="true" /><Typography size="heading4" fontWeight="bold">Scoring your call…</Typography><Typography size="paragraph3" tone="muted">Checking what {drill.practicerName || "you"} shared and how the call ended.</Typography></CardContent></Card>
      ) : drill.status === "error" || !drill.result ? (
        <div role="alert" className="note-box flex gap-3 border-red-200 bg-rose-light/80 p-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <div className="flex flex-col gap-0.5"><Typography fontWeight="semiBold" tone="inherit" className="text-red-900">Couldn&apos;t score this drill</Typography><Typography size="paragraph3" tone="inherit" className="text-red-800">{drill.error || "Something went wrong while scoring."}</Typography></div>
        </div>
      ) : (
        <ResultBody drill={drill} result={drill.result} />
      )}
      <Card>
        <CardHeader><Typography as="h3" size="heading4" fontWeight="bold">Recording &amp; transcript</Typography></CardHeader>
        <CardContent>
          <ConversationPlayback transcript={drill.transcript} recordingSrc={drill.hasRecording ? drillRecordingUrl(drill.id) : null} durationMs={drill.durationMs} aiLabel="Scammer (AI)" personLabel={drill.practicerName || "You"} heardLabel="AI heard" live={drill.status === "running"} liveText="On call…" />
        </CardContent>
      </Card>
    </div>
  );
}
