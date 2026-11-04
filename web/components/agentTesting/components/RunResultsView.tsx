"use client";

import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  MessagesSquare,
  Play,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type RefObject, useRef, useState } from "react";

import { Badge } from "@ui/components/ui/badge";
import { Button, buttonVariants } from "@ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@ui/components/ui/card";
import { EmptyState } from "@ui/components/ui/empty-state";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";
import type {
  AnswerStatus,
  Check,
  Conversation,
  ConversationStatus,
  EndReason,
  Run,
  RunSummary,
} from "../agentTesting.types";
import { recordingUrl } from "../agentTesting.service";
import { isRunActive, useGetRun, useGetRuns } from "../hooks/useRuns";

const STATUS_BADGE: Record<
  ConversationStatus,
  {
    label: string;
    variant: "success" | "danger" | "warning" | "primary" | "default";
  }
> = {
  passed: { label: "Passed", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  error: { label: "Test error", variant: "warning" },
  running: { label: "Running", variant: "primary" },
  queued: { label: "Queued", variant: "default" },
};

const END_REASON: Record<EndReason, string> = {
  agent_ended: "Agent ended the call",
  candidate_hung_up: "Candidate hung up",
  turn_limit: "Stopped at the turn limit",
};

const ANSWER_STATUS: Record<AnswerStatus, string> = {
  correct: "Correct",
  wrong: "Wrong",
  not_collected: "Not collected",
  declined: "Declined",
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const formatDuration = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function StatusIcon({ status }: { status: ConversationStatus }) {
  if (status === "passed")
    return (
      <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
    );
  if (status === "failed")
    return <XCircle className="size-4 text-red-600" aria-hidden="true" />;
  if (status === "error")
    return (
      <TriangleAlert className="size-4 text-amber-600" aria-hidden="true" />
    );
  if (status === "running")
    return (
      <Loader2
        className="text-ink size-4 animate-spin"
        aria-hidden="true"
      />
    );
  return <CircleDashed className="size-4 text-slate-500" aria-hidden="true" />;
}

function runLabel(run: RunSummary) {
  const result = isRunActive(run.status)
    ? `${run.counts.total - run.counts.pending}/${run.counts.total} done`
    : `${run.counts.passed}/${run.counts.total} passed`;
  return `${formatTime(run.createdAt)} · prompt v${run.promptVersion} · ${result}`;
}

/** Keeps ?agent= and the other params; `null` removes a param. */
function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`);
  };
}

function RunHeader({
  run,
  runs,
  onSelectRun,
}: {
  run: Run;
  runs: RunSummary[];
  onSelectRun: (id: string) => void;
}) {
  const { counts } = run;
  const done = counts.total - counts.pending;
  return (
    <Card tone="yellow">
      <CardHeader className="pr-24 max-sm:pr-5">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="panel-title">Test run</p>
          <Typography as="h2" size="heading3" fontWeight="bold">
            {isRunActive(run.status)
              ? `Running… ${done} of ${counts.total} conversations done`
              : run.status === "interrupted"
                ? "Run interrupted"
                : `${counts.passed} of ${counts.total} conversations passed`}
          </Typography>
          <Typography size="paragraph3" tone="muted">
            {run.mode === "voice" ? "Voice test" : "Chat test"} · prompt v
            {run.promptVersion} · started {formatTime(run.createdAt)}
          </Typography>
        </div>
        <label className="flex w-full min-w-0 items-center gap-2 text-sm font-semibold text-ink sm:w-auto">
          Run
          <select
            aria-label="Select test run"
            className="h-10 w-full min-w-0 cursor-pointer px-3 font-medium rounded-xl border-2 border-ink/25 bg-white text-sm text-ink hover:border-ink/45 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-sun/70 focus-visible:outline-none sm:w-auto sm:max-w-xs"
            value={run.id}
            onChange={(event) => onSelectRun(event.target.value)}
          >
            {runs.map((item) => (
              <option key={item.id} value={item.id}>
                {runLabel(item)}
              </option>
            ))}
          </select>
        </label>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          className="flex h-3 overflow-hidden rounded-full border-2 border-ink bg-white"
          aria-hidden="true"
        >
          {counts.total > 0 &&
            (
              [
                [counts.passed, "bg-emerald-500"],
                [counts.failed, "bg-red-500"],
                [counts.errored, "bg-amber-400"],
              ] as const
            ).map(([value, color]) =>
              value > 0 ? (
                <div
                  key={color}
                  className={color}
                  style={{ width: `${(value / counts.total) * 100}%` }}
                />
              ) : null,
            )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">{counts.passed} passed</Badge>
          <Badge variant="danger">{counts.failed} failed</Badge>
          {counts.errored > 0 && (
            <Badge variant="warning">{counts.errored} test errors</Badge>
          )}
          {counts.pending > 0 && <Badge>{counts.pending} still running</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

const CONVERSATION_LIMIT = 6;

function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: Conversation[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  // A handful at a time; the open conversation always stays visible.
  const listed = showAll || conversations.findIndex((c) => c.id === selectedId) >= CONVERSATION_LIMIT ? conversations : conversations.slice(0, CONVERSATION_LIMIT);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <Typography as="h2" size="heading4" fontWeight="bold">
          Conversations
        </Typography>
      </CardHeader>
      <ul className="tilt-list flex flex-col gap-2.5 p-4">
        {listed.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              aria-current={item.id === selectedId}
              onClick={() => onSelect(item.id)}
              className={cn(
                "sketch-tile flex w-full cursor-pointer items-start gap-3 px-3.5 py-3 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink",
              )}
            >
              <span className="mt-0.5">
                <StatusIcon status={item.status} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold text-ink">
                  {item.situationTitle}
                  {item.repeat > 1 && (
                    <span className="text-secondary-text">
                      {" "}
                      · #{item.repeat}
                    </span>
                  )}
                </span>
                <span className="text-secondary-text truncate text-xs">
                  {item.summary || item.error || item.category}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {conversations.length > CONVERSATION_LIMIT && <div className="px-4 pb-4"><Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((v) => !v)}>{listed.length < conversations.length ? `Show all ${conversations.length} conversations` : "Show fewer"}</Button></div>}
    </Card>
  );
}

function CheckRow({ check }: { check: Check }) {
  return (
    <li className="flex items-start gap-3 py-2">
      {check.passed ? (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-emerald-600"
          aria-label="Passed"
        />
      ) : (
        <XCircle
          className="mt-0.5 size-4 shrink-0 text-red-600"
          aria-label="Failed"
        />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          {check.name}
          <Badge>{check.kind}</Badge>
        </span>
        {check.detail && (
          <span className="text-secondary-text text-xs leading-5">
            {check.detail}
          </span>
        )}
      </span>
    </li>
  );
}

function Transcript({
  conversation,
  activeIndex,
  onPlayFrom,
}: {
  conversation: Conversation;
  activeIndex: number | null;
  onPlayFrom: ((ms: number) => void) | null;
}) {
  const live = conversation.status === "running";
  if (!conversation.transcript.length) {
    return (
      <Typography size="paragraph3" tone="muted">
        {live ? "Writing the test candidate…" : "No messages."}
      </Typography>
    );
  }
  return (
    <ol className="flex flex-col gap-3" aria-live={live ? "polite" : undefined}>
      {conversation.transcript.map((turn, index) => {
        const agent = turn.speaker === "agent";
        const startMs = turn.startMs;
        return (
          <li
            key={index}
            className={cn(
              "flex flex-col gap-1",
              agent ? "items-start" : "items-end",
            )}
          >
            <span className="text-secondary-text flex items-center gap-1.5 text-xs font-medium">
              {agent
                ? "Agent"
                : (conversation.scenario?.candidateName ?? "Candidate")}
              {onPlayFrom && startMs !== null && (
                <button
                  type="button"
                  onClick={() => onPlayFrom(startMs)}
                  aria-label={`Play from ${formatDuration(startMs)}`}
                  className="flex cursor-pointer items-center gap-0.5 rounded-full border border-ink/15 bg-white px-1.5 py-0.5 font-semibold text-ink hover:border-ink hover:bg-sun-light focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
                >
                  <Play className="size-3" aria-hidden="true" />
                  {formatDuration(startMs)}
                </button>
              )}
            </span>
            <span
              className={cn(
                "chat-bubble max-w-[85%] px-3.5 py-2.5 text-sm leading-6 break-words whitespace-pre-wrap sm:max-w-prose",
                agent ? "from-ai" : "from-person",
                turn.silent && "text-secondary-text italic",
                index === activeIndex && "ring-2 ring-ink ring-offset-2",
              )}
            >
              {turn.silent ? "(silence)" : turn.text}
            </span>
            {turn.heard !== null && (
              <span className="text-secondary-text max-w-[85%] text-right text-xs leading-5 break-words sm:max-w-prose">
                Agent heard: {turn.heard ? `“${turn.heard}”` : "nothing"}
              </span>
            )}
          </li>
        );
      })}
      {live && (
        <li className="text-secondary-text flex items-center gap-2 text-xs">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" /> In
          progress
        </li>
      )}
    </ol>
  );
}

function RecordingPlayer({
  run,
  conversation,
  audioRef,
  onPosition,
}: {
  run: Run;
  conversation: Conversation;
  audioRef: RefObject<HTMLAudioElement | null>;
  onPosition: (ms: number | null) => void;
}) {
  const recording = conversation.recording;
  if (!recording) {
    const pending =
      conversation.status === "queued" || conversation.status === "running";
    return (
      <Typography size="paragraph3" tone="muted">
        {pending
          ? "The recording appears here when the call ends."
          : "No recording for this conversation."}
      </Typography>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={recordingUrl(run.id, conversation.id)}
        className="w-full"
        onTimeUpdate={(event) =>
          onPosition(event.currentTarget.currentTime * 1000)
        }
        onEnded={() => onPosition(null)}
      >
        Your browser can&apos;t play this recording.
      </audio>
      <Typography size="caption" tone="muted">
        {formatDuration(recording.durationMs)} · agent voice{" "}
        {recording.agentVoice} · candidate voice {recording.candidateVoice}
      </Typography>
    </div>
  );
}

function ConversationDetail({
  run,
  conversation,
}: {
  run: Run;
  conversation: Conversation;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [positionMs, setPositionMs] = useState<number | null>(null);
  const playing =
    positionMs === null
      ? -1
      : conversation.transcript.findIndex(
          (turn) =>
            turn.startMs !== null &&
            turn.endMs !== null &&
            positionMs >= turn.startMs &&
            positionMs <= turn.endMs,
        );
  const playFrom = (ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = ms / 1000;
    void audio.play();
  };
  const badge = STATUS_BADGE[conversation.status];
  const checks = [...conversation.checks].sort(
    (a, b) => Number(a.passed) - Number(b.passed),
  );
  const scenario = conversation.scenario;
  return (
    <div className="flex flex-col gap-5">
      <Card tone="blue">
        <CardHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <Typography as="h2" size="heading3" fontWeight="bold" className="break-words">
              {conversation.situationTitle}
            </Typography>
            <Typography size="paragraph3" tone="muted">
              {conversation.category}
              {conversation.language && ` · ${conversation.language}`}
              {conversation.endReason &&
                ` · ${END_REASON[conversation.endReason]}`}
            </Typography>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </CardHeader>
        {(conversation.summary || conversation.error) && (
          <CardContent>
            <div
              className={cn(
                "note-box bg-white/80 p-3.5 text-sm leading-6 text-ink",
                conversation.status === "passed" &&
                  "border-emerald-300 bg-mint/70 text-emerald-950",
                conversation.status === "failed" && "border-red-300 bg-rose-light text-red-950",
                conversation.status === "error" && "border-amber-300 bg-amber-50 text-amber-950",
              )}
            >
              {conversation.error || conversation.summary}
            </div>
          </CardContent>
        )}
      </Card>

      {checks.length > 0 && (
        <Card>
          <CardHeader>
            <Typography as="h3" size="heading4" fontWeight="bold">
              Checks
            </Typography>
            <Typography size="paragraph3" tone="muted">
              {checks.filter((c) => !c.passed).length} failed of {checks.length}
            </Typography>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y-2 divide-dashed divide-ink/10">
              {checks.map((check) => (
                <CheckRow key={`${check.kind}-${check.name}`} check={check} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {conversation.answers.length > 0 && (
        <Card tone="plain">
          <CardHeader>
            <Typography as="h3" size="heading4" fontWeight="bold">
              Answers
            </Typography>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="panel-title text-[11px]">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Answer
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Should be
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Agent got
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-dashed divide-ink/10">
                {conversation.answers.map((answer) => (
                  <tr key={answer.key} className="align-top">
                    <td className="py-2 pr-4 font-mono text-xs">
                      {answer.key}
                    </td>
                    <td className="py-2 pr-4">{answer.expected || "—"}</td>
                    <td className="py-2 pr-4">{answer.agentValue || "—"}</td>
                    <td className="py-2">
                      <Badge variant={answer.acceptable ? "success" : "danger"}>
                        {ANSWER_STATUS[answer.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <Typography as="h3" size="heading4" fontWeight="bold">
              {run.mode === "voice" ? "Recording & transcript" : "Transcript"}
            </Typography>
          </CardHeader>
          {run.mode === "voice" && (
            <CardContent>
              <RecordingPlayer
                run={run}
                conversation={conversation}
                audioRef={audioRef}
                onPosition={setPositionMs}
              />
            </CardContent>
          )}
          <CardContent className="rounded-b-[22px] border-t-2 border-dashed border-ink/12 bg-white/60">
            <Transcript
              conversation={conversation}
              activeIndex={playing === -1 ? null : playing}
              onPlayFrom={conversation.recording ? playFrom : null}
            />
          </CardContent>
        </Card>
        {scenario && (
          <Card tone="rose">
            <CardHeader>
              <Typography as="h3" size="heading4" fontWeight="bold">
                Test candidate
              </Typography>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-ink">
              <div>
                <Typography fontWeight="semiBold">
                  {scenario.candidateName}
                </Typography>
                <Typography size="paragraph3" tone="muted">
                  {scenario.persona} · starts in {scenario.startLanguage}
                </Typography>
              </div>
              <Typography size="paragraph3">{scenario.behavior}</Typography>
              <div className="flex flex-col gap-1">
                <Typography size="caption" fontWeight="semiBold">
                  What they say
                </Typography>
                {scenario.answers.map((answer) => (
                  <Typography key={answer.key} size="paragraph3" tone="muted">
                    <span className="font-mono">{answer.key}</span>: “
                    {answer.spoken}”
                  </Typography>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function RunDetail({ runId, runs }: { runId: string; runs: RunSummary[] }) {
  const { data: run, isPending, isError, refetch } = useGetRun(runId);
  const setParams = useSetParams();
  const requested = useSearchParams().get("conversation");

  if (isPending) return <Skeleton className="h-96 w-full" />;
  if (isError)
    return (
      <EmptyState
        variant="error"
        icon={<AlertCircle className="size-5" aria-hidden="true" />}
        title="Couldn't load this run"
        action={
          <Button variant="outlined" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    );

  // Default to the first failure: that is what someone opening a finished run came to see.
  const selected =
    run.conversations.find((c) => c.id === requested) ??
    run.conversations.find((c) => c.status === "failed") ??
    run.conversations[0];

  return (
    <div className="flex flex-col gap-5">
      <RunHeader
        run={run}
        runs={runs}
        onSelectRun={(id) => setParams({ run: id, conversation: null })}
      />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        <ConversationList
          conversations={run.conversations}
          selectedId={selected?.id}
          onSelect={(id) => setParams({ conversation: id })}
        />
        <div className="min-w-0 xl:col-span-2">
          {selected && (
            // Keyed so playback state resets when another conversation is opened.
            <ConversationDetail
              key={selected.id}
              run={run}
              conversation={selected}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function RunResultsView({ agentId }: { agentId: string }) {
  const { data: runs, isPending, isError, refetch } = useGetRuns(agentId);
  const requested = useSearchParams().get("run");

  if (isPending) return <Skeleton className="h-96 w-full" />;
  if (isError)
    return (
      <EmptyState
        variant="error"
        icon={<AlertCircle className="size-5" aria-hidden="true" />}
        title="Couldn't load test runs"
        description="The Kavach service is unreachable. Check that it is running."
        action={
          <Button variant="outlined" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    );
  if (!runs.length)
    return (
      <Card tone="plain">
        <CardContent className="py-8">
          <EmptyState
            icon={<MessagesSquare className="size-5" aria-hidden="true" />}
            title="No test runs yet"
            description="Pick candidate situations on Edge-case testing and start a run. Each conversation shows up here as it happens."
            action={
              <Link
                href={`/agent-testing/tests?agent=${encodeURIComponent(agentId)}`}
                className={buttonVariants({ variant: "contained" })}
              >
                Go to Edge-case testing
              </Link>
            }
          />
        </CardContent>
      </Card>
    );

  const current = runs.find((run) => run.id === requested) ?? runs[0];
  return current ? <RunDetail runId={current.id} runs={runs} /> : null;
}
