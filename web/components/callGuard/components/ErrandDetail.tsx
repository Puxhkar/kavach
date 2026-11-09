"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, ArrowRight, CalendarClock, CircleCheck, Loader2, MessageSquareText, PhoneOutgoing, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@ui/components/ui/card";
import { EmptyState } from "@ui/components/ui/empty-state";
import { SelectField } from "@ui/components/ui/input-field";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";

import { BEHAVIOURS, errandBadge, formatDuration, isErrandActive, timeAgo } from "../callGuard.constants";
import { callGuardKeys, errandRecordingUrl } from "../callGuard.service";
import type { Errand, ErrandReport, RecipientBehaviour } from "../callGuard.types";
import { useGetErrand, useSimulateErrand } from "../hooks/useErrands";
import { useGetProfile } from "../hooks/useGuardProfile";
import { errorText } from "../utils/errorText";
import ConversationPlayback from "./ConversationPlayback";
import { LanguagePill, OutcomeBadge } from "./GuardBadges";
import LiveCall from "./LiveCall";
import VoiceNote from "./VoiceNote";

function ErrandHeader({ errand }: { errand: Errand }) {
  const badge = errandBadge(errand.status, errand.report?.outcome ?? null);
  const meta = [timeAgo(errand.createdAt), errand.source === "live" ? "Called on this device" : errand.source === "simulated" ? "Simulated call" : null, errand.durationMs > 0 ? formatDuration(errand.durationMs) : null].filter(Boolean).join(" · ");
  return (
    <Card tone="plain">
      <CardHeader className="border-b-0 pt-5">
        <div className="flex min-w-0 flex-col gap-1">
          <Typography as="h2" size="heading3" fontWeight="bold" className="break-words">Call {errand.recipientName}</Typography>
          {errand.recipientRole && <Typography size="paragraph2" tone="muted">{errand.recipientRole}</Typography>}
          <Typography size="caption" tone="muted">{meta}</Typography>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-semibold whitespace-nowrap", badge.className)}>{badge.label}</span>
          {/* Once reported, the report card carries it. */}
          {errand.language && !errand.report && <LanguagePill language={errand.language} prefix={errand.status === "running" ? "Speaking: " : "Spoke in: "} className="px-2.5 py-1 text-sm" />}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-0 pb-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="note-box flex gap-2.5 bg-paper p-3.5">
          <MessageSquareText className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="panel-title text-[11px]">The message</span>
            <span className="text-sm leading-6 break-words whitespace-pre-wrap text-ink">{errand.task}</span>
          </div>
        </div>
        <div className="note-box flex gap-2.5 bg-paper p-3.5">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="panel-title text-[11px]">By when</span>
            <span className="text-sm leading-6 break-words text-ink">{errand.deadline || "No deadline"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportCard({ report, language }: { report: ErrandReport; language: string | null }) {
  return (
    <Card tone="yellow">
      <CardHeader>
        <Typography as="h3" size="heading4" fontWeight="bold">Report</Typography>
        <div className="flex flex-wrap gap-1.5">
          <OutcomeBadge outcome={report.outcome} className="px-2.5 py-1 text-sm" />
          {language && <LanguagePill language={language} prefix="Spoke in: " className="px-2.5 py-1 text-sm" />}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Typography size="paragraph1" className="leading-7">{report.summary}</Typography>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="note-box flex gap-2.5 border-emerald-200 bg-mint/70 p-3.5">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[11px] font-extrabold tracking-[0.12em] text-emerald-900 uppercase">Commitment</span>
              <span className="text-sm leading-6 text-ink">{report.commitment || "No commitment made."}</span>
            </div>
          </div>
          <div className="note-box flex gap-2.5 border-blue-200 bg-sky/70 p-3.5">
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-blue-800" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[11px] font-extrabold tracking-[0.12em] text-blue-900 uppercase">Next step</span>
              <span className="text-sm leading-6 text-ink">{report.nextStep || "Nothing to do."}</span>
            </div>
          </div>
        </div>
        {report.concerns.length > 0 && (
          <div className="note-box flex flex-col gap-2 border-amber-300 bg-amber-50 p-3.5">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-900"><TriangleAlert className="size-4" aria-hidden="true" />Concerns raised</span>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-amber-950">{report.concerns.map((concern) => <li key={concern}>{concern}</li>)}</ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** "Call now on this device" plus "Simulate the call" with the recipient's language and behaviour. */
function CallActions({ errand, onCallNow }: { errand: Errand; onCallNow: () => void }) {
  const { data: profile } = useGetProfile();
  const simulate = useSimulateErrand();
  const listen = profile?.listenLanguages ?? [];
  // Default to a language other than the opening one, so the switch shows.
  const [pickedLanguage, setPickedLanguage] = useState("");
  const [behaviour, setBehaviour] = useState<RecipientBehaviour>("agrees");
  const language = listen.includes(pickedLanguage) ? pickedLanguage : (listen.find((l) => l !== profile?.language) ?? listen[0] ?? "");

  const run = () =>
    simulate.mutate(
      { errandId: errand.id, body: { language, behaviour } },
      {
        onSuccess: () => toast.success(`Calling ${errand.recipientName}. An AI plays them, speaking ${language}.`),
        onError: (error) => toast.error(errorText(error, "Couldn't start the call.")),
      },
    );

  return (
    <Card tone="blue">
      <CardHeader className="py-4"><Typography as="h3" size="heading4" fontWeight="bold">{errand.status === "pending" ? "Make the call" : "Call again"}</Typography></CardHeader>
      <CardContent className="grid gap-5 py-5 md:grid-cols-2 md:gap-0 md:divide-x-2 md:divide-dashed md:divide-ink/12">
        <div className="flex flex-col gap-3 md:pr-5">
          <Typography size="paragraph3" tone="muted">Hand this device to {errand.recipientName}. The assistant asks which language they prefer, then speaks it.</Typography>
          <Button variant="blue" className="h-11 w-full sm:w-auto sm:self-start" onClick={onCallNow} title="Starts a live call in this browser using your microphone"><PhoneOutgoing aria-hidden="true" />Call now on this device</Button>
        </div>
        <div className="flex flex-col gap-3 border-t-2 border-dashed border-ink/12 pt-5 md:border-t-0 md:pt-0 md:pl-5">
          <Typography size="paragraph3" tone="muted">Or let an AI play {errand.recipientName}.</Typography>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField id="errand-sim-language" label="They speak" value={language} onChange={(e) => setPickedLanguage(e.target.value)} disabled={!profile}>
              {listen.map((l) => <option key={l} value={l}>{l}</option>)}
            </SelectField>
            <SelectField id="errand-sim-behaviour" label="They…" value={behaviour} onChange={(e) => setBehaviour(e.target.value as RecipientBehaviour)}>
              {BEHAVIOURS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </SelectField>
          </div>
          <Button variant="quiet" className="h-11 w-full sm:w-auto sm:self-start" disabled={!language || simulate.isPending} onClick={run} title="An AI plays the person, so you can watch the whole call without a microphone">
            {simulate.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            Simulate the call
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveErrandCall({ errand, onDone }: { errand: Errand; onDone: () => void }) {
  const { data: profile } = useGetProfile();
  const listen = profile?.listenLanguages ?? [];
  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" size="sm" className="self-start" onClick={onDone}><ArrowLeft aria-hidden="true" />Back</Button>
      <VoiceNote />
      <LiveCall
        startBody={{ kind: "errand", errandId: errand.id }}
        aiLabel="Assistant"
        personLabel={`${errand.recipientName} (as heard)`}
        startLabel={`Call ${errand.recipientName}`}
        onFinished={onDone}
        intro={
          <div className="note-box flex flex-col gap-3 border-blue-200 bg-sky/60 p-4">
            <div className="flex gap-3">
              <PhoneOutgoing className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
              <Typography size="paragraph2" tone="inherit" className="text-ink">The assistant will call {errand.recipientName}. Hand this device to them — it will ask which language they prefer, then speak it.</Typography>
            </div>
            {listen.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-8">
                <span className="text-xs font-semibold text-ink">It offers</span>
                {listen.map((l) => <LanguagePill key={l} language={l} />)}
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}

export default function ErrandDetail({ errandId }: { errandId: string }) {
  const { data: errand, isPending, error, refetch } = useGetErrand(errandId);
  const queryClient = useQueryClient();
  const [calling, setCalling] = useState(false);

  if (isPending) return <div className="flex flex-col gap-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!errand) return <EmptyState variant="error" icon={<AlertCircle className="size-5" aria-hidden="true" />} title="Couldn't load this call" description={error?.message} action={<Button variant="outlined" onClick={() => void refetch()}>Try again</Button>} />;

  // After a live call (or Back mid-call, which hangs up) refetch so the polling picks up "triaging".
  const stopCalling = () => {
    setCalling(false);
    void queryClient.invalidateQueries({ queryKey: callGuardKeys.errand(errand.id) });
    void queryClient.invalidateQueries({ queryKey: callGuardKeys.errands() });
  };

  const active = isErrandActive(errand.status);
  const actions = !active && <CallActions errand={errand} onCallNow={() => setCalling(true)} />;
  return (
    <div className="flex flex-col gap-5">
      <ErrandHeader errand={errand} />
      {calling ? (
        <LiveErrandCall errand={errand} onDone={stopCalling} />
      ) : (
        <>
          {errand.status === "pending" && actions}
          {active ? (
            <Card tone="yellow">
              <CardContent className="flex flex-col gap-3 py-5">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {errand.status === "running" ? `On call… the assistant is talking to ${errand.recipientName}.` : "Writing the report…"}
                </span>
                <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ) : errand.status === "error" ? (
            <div role="alert" className="note-box flex gap-3 border-red-200 bg-rose-light/80 p-4">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <Typography fontWeight="semiBold" tone="inherit" className="text-red-900">The call didn&apos;t go through</Typography>
                <Typography size="paragraph3" tone="inherit" className="text-red-800">{errand.error || "Something went wrong during the call."}</Typography>
              </div>
            </div>
          ) : errand.report ? (
            <ReportCard report={errand.report} language={errand.language} />
          ) : null}
          {errand.status !== "pending" && (
            <Card>
              <CardHeader><Typography as="h3" size="heading4" fontWeight="bold">Recording &amp; transcript</Typography></CardHeader>
              <CardContent>
                {/* An errand can be called again, replacing its recording at the same URL; the query keeps the browser from replaying the old one. */}
                <ConversationPlayback transcript={errand.transcript} recordingSrc={errand.hasRecording ? `${errandRecordingUrl(errand.id)}?v=${errand.durationMs}` : null} durationMs={errand.durationMs} aiLabel="Assistant" personLabel={errand.recipientName} heardLabel="Assistant heard" live={errand.status === "running"} liveText="On call…" />
              </CardContent>
            </Card>
          )}
          {errand.status !== "pending" && actions}
        </>
      )}
    </div>
  );
}
