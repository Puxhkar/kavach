"use client";

import { Bot, Languages, Loader2, Mic, PhoneIncoming, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import PageIntro from "@/components/layout/PageIntro";
import { Button } from "@ui/components/ui/button";
import { Card, CardContent } from "@ui/components/ui/card";
import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";

import { CALL_GUARD_SETTINGS_ROUTE } from "../callGuard.constants";
import { useGetCalls, useSimulateCall } from "../hooks/useCalls";
import { useGetProfile } from "../hooks/useGuardProfile";
import { useGetScenarios } from "../hooks/useGetScenarios";
import CallDetail from "./CallDetail";
import { CallList } from "./CallList";
import LiveCall from "./LiveCall";
import VoiceNote from "./VoiceNote";

type Mode = "yourself" | "ai";

const RECENT_LIMIT = 5;

const MODES: { value: Mode; label: string; icon: typeof Mic }[] = [
  { value: "yourself", label: "Talk to it yourself", icon: Mic },
  { value: "ai", label: "Let an AI caller ring", icon: Bot },
];

/** Pick one AI caller and ring the assistant with it. */
function AiCallerPicker({ onCreated }: { onCreated: (callId: string) => void }) {
  const { data, isPending } = useGetScenarios();
  const simulate = useSimulateCall();
  const [picked, setPicked] = useState("");
  const callers = data?.callers ?? [];
  const caller = callers.find((c) => c.id === picked) ?? callers[0];

  const ring = () => {
    if (!caller) return;
    simulate.mutate(caller.id, {
      onSuccess: (call) => {
        toast.success(`${caller.title} is calling. The assistant picked up.`);
        onCreated(call.id);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-6">
        <div className="flex flex-col gap-1">
          <Typography size="heading4" fontWeight="bold">Watch the assistant handle a caller</Typography>
          <Typography tone="muted">An AI plays the caller, in its own language. Takes about a minute.</Typography>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Who is calling?
          <select className="h-12 cursor-pointer rounded-xl border-2 border-ink/25 bg-white px-3 text-[15px] font-normal text-ink hover:border-ink/45 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-sun/70 focus-visible:outline-none" value={caller?.id ?? ""} onChange={(e) => setPicked(e.target.value)} disabled={isPending || simulate.isPending}>
            {callers.map((c) => <option key={c.id} value={c.id}>{c.title}{c.scam ? " (scam)" : ""} · {c.language}</option>)}
          </select>
        </label>
        {caller && <Typography size="paragraph3" tone="muted">{caller.description}</Typography>}
        <Button className="h-12 self-start px-6" disabled={!caller || simulate.isPending} onClick={ring}>
          {simulate.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PhoneIncoming aria-hidden="true" />}
          {simulate.isPending ? "Ringing…" : "Ring the assistant"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** One call's summary, recording and transcript, over the page. Esc or the close button returns. */
function CallDrawer({ callId, onClose }: { callId: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Call details" className="drawer-in relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l-2 border-ink bg-paper shadow-paper">
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink/10 bg-white px-5 py-3">
          <Typography fontWeight="bold">Call details</Typography>
          <Button ref={closeRef} variant="ghost" size="icon" aria-label="Close call details" onClick={onClose}><X aria-hidden="true" /></Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <CallDetail key={callId} callId={callId} />
        </div>
      </div>
    </div>
  );
}

export default function AnswerCallView() {
  const router = useRouter();
  const pathname = usePathname();
  const openCallId = useSearchParams().get("call");
  const { data: profile } = useGetProfile();
  const { data: calls } = useGetCalls();
  const [mode, setMode] = useState<Mode>("yourself");
  const [showAll, setShowAll] = useState(false);
  const owner = profile?.ownerName || "you";
  const listen = profile?.listenLanguages ?? [];
  const recent = calls ?? [];
  const listed = showAll ? recent : recent.slice(0, RECENT_LIMIT);

  // The open call lives in ?call= so a finished call opens straight away and reloads keep it.
  const open = (callId: string) => router.replace(`${pathname}?call=${encodeURIComponent(callId)}`, { scroll: false });
  const close = () => router.replace(pathname, { scroll: false });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7">
      <PageIntro kicker="Call Guard" title="Answer calls" description={`Your assistant picks up for ${owner}, finds out who's calling and why, and blocks scams. Try it yourself, or let an AI caller ring it.`} />
      <VoiceNote />

      <div role="tablist" aria-label="How to try it" className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-ink/10 bg-white p-1.5">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={cn("flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink", mode === value ? "bg-ink text-white" : "text-ink hover:bg-ink/5")}>
            <Icon className="size-4" aria-hidden="true" />{label}
          </button>
        ))}
      </div>

      {mode === "yourself" ? (
        <LiveCall
          startBody={{ kind: "screener" }}
          aiLabel="Assistant"
          startLabel="Call the assistant"
          onFinished={(end) => open(end.id)}
          intro={
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Typography size="heading4" fontWeight="bold">You are the caller.</Typography>
                <Typography tone="muted">Say who you are and why you&apos;re calling — or try to scam it.</Typography>
              </div>
              {profile && listen.length > 0 && (
                <div className="note-box flex gap-3 border-violet-200 bg-violet-50/80 p-3.5">
                  <Languages className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden="true" />
                  <Typography size="paragraph3" tone="inherit" className="text-violet-950">
                    Speak {listen.join(", ")} (<Link href={CALL_GUARD_SETTINGS_ROUTE} className="font-medium underline underline-offset-2">change</Link>). It greets you in {profile.language} and answers in your language.
                  </Typography>
                </div>
              )}
            </div>
          }
        />
      ) : (
        <AiCallerPicker onCreated={open} />
      )}

      {recent.length > 0 && (
        <section aria-label="Your calls" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <Typography as="h2" size="heading4" fontWeight="bold">Your calls</Typography>
            <Typography size="paragraph3" tone="muted">Most important first · tap one for the summary</Typography>
          </div>
          <CallList calls={listed} selectedId={openCallId} onSelect={open} />
          {recent.length > RECENT_LIMIT && <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${recent.length} calls`}</Button>}
        </section>
      )}

      {openCallId && <CallDrawer callId={openCallId} onClose={close} />}
    </div>
  );
}
