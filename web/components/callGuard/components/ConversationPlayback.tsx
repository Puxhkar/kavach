"use client";

import { Loader2, Play } from "lucide-react";
import { Fragment, useRef, useState } from "react";

import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";

import { formatDuration, heardDiffers, languageSwitches } from "../callGuard.constants";
import type { Turn } from "../callGuard.types";
import { LanguagePill, LanguageSwitchDivider } from "./GuardBadges";

type ConversationPlaybackProps = {
  transcript: Turn[];
  /** `null` when there is no recording (yet). */
  recordingSrc: string | null;
  durationMs: number;
  aiLabel: string;
  personLabel: string;
  /** Who mishears the person: "Assistant heard" / "AI heard". */
  heardLabel: string;
  live: boolean;
  liveText: string;
};

/** Recording player plus a transcript whose lines seek the recording ("play from"), tagged with each line's language. */
export default function ConversationPlayback({ transcript, recordingSrc, durationMs, aiLabel, personLabel, heardLabel, live, liveText }: ConversationPlaybackProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [positionMs, setPositionMs] = useState<number | null>(null);
  const switches = languageSwitches(transcript);
  const activeIndex = positionMs === null ? -1 : transcript.findIndex((turn) => turn.startMs !== null && turn.endMs !== null && positionMs >= turn.startMs && positionMs <= turn.endMs);
  const playFrom = (ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = ms / 1000;
    void audio.play();
  };

  return (
    <div className="flex flex-col gap-4">
      {recordingSrc ? (
        <div className="flex flex-col gap-1.5">
          <audio ref={audioRef} controls preload="metadata" src={recordingSrc} className="w-full" onTimeUpdate={(event) => setPositionMs(event.currentTarget.currentTime * 1000)} onEnded={() => setPositionMs(null)}>
            Your browser can&apos;t play this recording.
          </audio>
          {durationMs > 0 && <Typography size="caption" tone="muted">Recording · {formatDuration(durationMs)}</Typography>}
        </div>
      ) : (
        <Typography size="paragraph3" tone="muted">{live ? "The recording appears here when the call ends." : "No recording for this call."}</Typography>
      )}
      {!transcript.length ? (
        <Typography size="paragraph3" tone="muted" className="flex items-center gap-2">
          {live && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
          {live ? liveText : "No transcript."}
        </Typography>
      ) : (
        <ol className="flex flex-col gap-3" aria-live={live ? "polite" : undefined}>
          {transcript.map((turn, index) => {
            const ai = turn.speaker === "ai";
            const startMs = turn.startMs;
            const switchedTo = switches[index];
            return (
              <Fragment key={index}>
                {switchedTo && <li className="py-0.5"><LanguageSwitchDivider language={switchedTo} /></li>}
                <li className={cn("flex flex-col gap-1", ai ? "items-start" : "items-end")}>
                  <span className={cn("flex flex-wrap items-center gap-1.5 text-xs font-medium text-secondary-text", !ai && "justify-end")}>
                    {ai ? aiLabel : personLabel}
                    {recordingSrc && startMs !== null && (
                      <button type="button" onClick={() => playFrom(startMs)} aria-label={`Play from ${formatDuration(startMs)}`} className="flex cursor-pointer items-center gap-0.5 rounded-full border border-ink/15 bg-white px-1.5 py-0.5 font-semibold text-ink hover:border-ink hover:bg-sun-light focus-visible:outline-2 focus-visible:outline-ink">
                        <Play className="size-3" aria-hidden="true" />
                        {formatDuration(startMs)}
                      </button>
                    )}
                    {turn.language && <LanguagePill language={turn.language} detected={!ai} />}
                  </span>
                  <span className={cn("chat-bubble max-w-[85%] px-3.5 py-2.5 text-sm leading-6 break-words whitespace-pre-wrap sm:max-w-prose", ai ? "from-ai" : "from-person", index === activeIndex && "border-ink ring-2 ring-ink", !turn.text && "text-secondary-text italic")}>
                    {turn.text || "(silence)"}
                  </span>
                  {!ai && heardDiffers(turn.text, turn.heard) && (
                    <span className="max-w-[85%] text-right text-xs leading-5 break-words text-secondary-text sm:max-w-prose">
                      {heardLabel}: {turn.heard ? `“${turn.heard}”` : "nothing"}
                    </span>
                  )}
                </li>
              </Fragment>
            );
          })}
          {live && (
            <li className="flex items-center gap-2 text-xs text-secondary-text">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" /> {liveText}
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
