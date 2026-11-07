"use client";

import { Loader2, Mic, PhoneCall, PhoneOff, Send } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/apis/utils/apiClient";
import { Button } from "@ui/components/ui/button";
import { Card, CardContent } from "@ui/components/ui/card";
import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";

import { formatDuration, languageSwitches, lastAiLanguage } from "../callGuard.constants";
import { endLive } from "../callGuard.service";
import type { LiveEnd, SpokenLine, StartLiveBody } from "../callGuard.types";
import { useEndLive, useSendLiveTurn, useStartLive } from "../hooks/useLiveCall";
import { TooShortError, useMicRecorder } from "../hooks/useMicRecorder";
import { errorText } from "../utils/errorText";
import { ReplyPlayer } from "../utils/replyPlayer";
import { LanguagePill, LanguageSwitchDivider } from "./GuardBadges";

type Phase = "setup" | "starting" | "on_call" | "ending";
type Status = "idle" | "listening" | "sending" | "speaking";
/** `language`: what the AI spoke, or what speech recognition detected the person speaking. */
type Line = { speaker: "ai" | "person"; text: string; language: string | null };

type LiveCallProps = {
  startBody: StartLiveBody;
  /** Shown above the start button: what is about to happen. */
  intro: React.ReactNode;
  /** Extra fields before the call starts (the drill's form). */
  setup?: React.ReactNode;
  startLabel: string;
  canStart?: boolean;
  /** Who the AI is: "Assistant", "Caller". */
  aiLabel: string;
  /** Over the person's lines. */
  personLabel?: string;
  onFinished: (end: LiveEnd) => void;
};

/** The browser phone call shared by "Answer a call", the scam drill and "Call for me". The AI always speaks first. */
export default function LiveCall({ startBody, intro, setup, startLabel, canStart = true, aiLabel, personLabel = "You said (as heard)", onFinished }: LiveCallProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [status, setStatus] = useState<Status>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const liveIdRef = useRef<string | null>(null);
  const closingRef = useRef(false);
  const [player] = useState(() => new ReplyPlayer());
  const transcriptRef = useRef<HTMLOListElement>(null);
  const mic = useMicRecorder();
  const startLive = useStartLive();
  const sendTurn = useSendLiveTurn();
  const endLiveMutation = useEndLive();

  // Leaving the page mid-call hangs up so the server doesn't keep the call open.
  useEffect(
    () => () => {
      player.stop();
      const liveId = liveIdRef.current;
      if (liveId && !closingRef.current) {
        closingRef.current = true;
        void endLive(liveId, true).catch(() => undefined);
      }
    },
    [player],
  );

  useEffect(() => {
    if (phase !== "on_call") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    const list = transcriptRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines, status]);

  const reset = () => {
    liveIdRef.current = null;
    closingRef.current = false;
    setPhase("setup");
    setStatus("idle");
  };

  const speak = async (line: SpokenLine) => {
    setLines((prev) => [...prev, { speaker: "ai", text: line.text, language: line.language || null }]);
    if (!line.audioBase64) return;
    setStatus("speaking");
    await player.play(line.audioBase64);
  };

  const finish = async (hungUp: boolean) => {
    const liveId = liveIdRef.current;
    if (!liveId || closingRef.current) return;
    closingRef.current = true;
    player.stop();
    mic.cancel();
    setPhase("ending");
    try {
      onFinished(await endLiveMutation.mutateAsync({ liveId, hungUp }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't end the call.");
      reset();
    }
  };

  const begin = async () => {
    // Inside the click, before the network round trip, so the first reply may autoplay.
    player.unlock();
    setLines([]);
    setPhase("starting");
    try {
      const res = await startLive.mutateAsync(startBody);
      liveIdRef.current = res.liveId;
      closingRef.current = false;
      setStartedAt(Date.now());
      setNow(Date.now());
      setPhase("on_call");
      await speak(res.reply);
      if (closingRef.current) return;
      if (res.ended) return void finish(false);
      setStatus("idle");
    } catch (error) {
      toast.error(errorText(error, "Couldn't start the call."));
      reset();
    }
  };

  const sendRecording = async () => {
    const liveId = liveIdRef.current;
    if (!liveId) return;
    setStatus("sending");
    let wav: Blob;
    try {
      wav = await mic.stop();
    } catch (error) {
      if (error instanceof TooShortError) toast.info("Tap once, say your line, then tap again to send.");
      else toast.error(error instanceof Error ? error.message : "Couldn't read the recording. Try again.");
      setStatus("idle");
      return;
    }
    try {
      const res = await sendTurn.mutateAsync({ liveId, wav });
      if (closingRef.current) return;
      setLines((prev) => [...prev, { speaker: "person", text: res.heard, language: res.heardLanguage }]);
      if (res.reply) await speak(res.reply);
      if (closingRef.current) return;
      if (res.ended) return void finish(false);
      setStatus("idle");
    } catch (error) {
      if (closingRef.current) return;
      toast.error(error instanceof Error ? error.message : "Couldn't send that. Try again.");
      if (error instanceof ApiError && error.code === "live_not_found") reset();
      else setStatus("idle");
    }
  };

  const toggleTalk = async () => {
    if (status === "listening") return void sendRecording();
    if (status !== "idle") return;
    try {
      await mic.start();
      setStatus("listening");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start the microphone.");
    }
  };

  if (phase === "setup" || phase === "starting") {
    return (
      <Card tone="paper">
        <CardContent className="flex flex-col gap-6 py-6">
          {intro}
          {setup}
          <Button className="h-12 w-full text-base sm:w-auto sm:self-start sm:px-8" disabled={!canStart || phase === "starting"} onClick={() => void begin()}>
            {phase === "starting" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PhoneCall aria-hidden="true" />}
            {phase === "starting" ? "Connecting…" : startLabel}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const ending = phase === "ending";
  const statusText = ending ? "Ending the call…" : status === "listening" ? "Listening… tap again to send" : status === "sending" ? "Sending…" : status === "speaking" ? `${aiLabel} is speaking…` : "Your turn. Tap to talk.";
  const talkDisabled = ending || status === "sending" || status === "speaking";
  const speaking = lastAiLanguage(lines);
  const switches = languageSwitches(lines);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b-2 border-dashed border-ink/12 bg-white/70 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" /><span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" /></span>
            On call{startedAt !== null && ` · ${formatDuration(Math.max(0, now - startedAt))}`}
          </span>
          {speaking && <span aria-live="polite"><LanguagePill language={speaking} prefix="Speaking: " className="py-0.5 text-xs" /></span>}
        </div>
        <Button variant="destructive" disabled={ending} onClick={() => void finish(true)}><PhoneOff aria-hidden="true" />Hang up</Button>
      </div>
      <CardContent className="flex flex-col items-center gap-5 py-8">
        <p className="text-center text-base font-semibold text-ink" aria-live="polite">{statusText}</p>
        <button type="button" onClick={() => void toggleTalk()} disabled={talkDisabled} aria-pressed={status === "listening"} aria-label={status === "listening" ? "Stop and send" : "Start talking"} className={cn("relative grid size-32 cursor-pointer place-items-center rounded-full border-[3px] border-ink-line shadow-[6px_6px_0_#0f172a] transition-[transform,box-shadow,background-color] hover:shadow-sketch motion-safe:hover:translate-x-0.5 motion-safe:hover:translate-y-0.5 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ink active:shadow-sketch-sm disabled:cursor-not-allowed disabled:opacity-50", status === "listening" ? "bg-red-600 text-white" : "bg-sun text-ink hover:bg-[#fcd931]")}>
          {status === "listening" && <span className="absolute inset-0 animate-ping rounded-full bg-red-400/40 motion-reduce:animate-none" aria-hidden="true" />}
          {status === "sending" || ending ? <Loader2 className="size-10 animate-spin" aria-hidden="true" /> : status === "listening" ? <Send className="relative size-10" aria-hidden="true" /> : <Mic className="size-10" aria-hidden="true" />}
        </button>
        <Typography size="caption" tone="muted" textAlign="center">{status === "listening" ? "Tap to send" : "Tap to talk"}</Typography>
      </CardContent>
      <div className="border-t-2 border-dashed border-ink/12 px-4 py-5 sm:px-6">
        <ol ref={transcriptRef} className="flex max-h-[45dvh] flex-col gap-3 overflow-y-auto" aria-label="Call transcript">
          {lines.map((line, index) => (
            <Fragment key={index}>
              {switches[index] && <li className="py-0.5"><LanguageSwitchDivider language={switches[index]} /></li>}
              <li className={cn("flex flex-col gap-1", line.speaker === "ai" ? "items-start" : "items-end")}>
                <span className={cn("flex flex-wrap items-center gap-1.5 text-xs font-medium text-secondary-text", line.speaker === "person" && "justify-end")}>
                  {line.speaker === "ai" ? aiLabel : personLabel}
                  {line.language && <LanguagePill language={line.language} detected={line.speaker === "person"} />}
                </span>
                <span className={cn("chat-bubble max-w-[85%] px-3.5 py-2.5 text-sm leading-6 break-words", line.speaker === "ai" ? "from-ai" : "from-person", line.speaker === "person" && !line.text && "text-secondary-text italic")}>
                  {line.speaker === "person" && !line.text ? "(nothing heard)" : line.text}
                </span>
              </li>
            </Fragment>
          ))}
          {status === "sending" && <li className="flex items-center gap-2 self-end text-xs text-secondary-text"><Loader2 className="size-3 animate-spin" aria-hidden="true" />Sending…</li>}
        </ol>
      </div>
    </Card>
  );
}
