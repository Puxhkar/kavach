"use client";

import { Bot, Check, FlaskConical, Languages, PhoneCall, ShieldAlert } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { cn } from "@ui/lib/utils";

type Side = "left" | "right";

type Party = { name: string; role: string; avatar: "bot" | "tester" | string; tone: string };

type Beat =
  | { kind: Side; lang: string; text: string; meaning?: string }
  | { kind: "note"; text: string }
  | { kind: "stamp"; tone: "good" | "bad"; text: string };

type Scene = { label: string; left: Party; right: Party; beats: Beat[] };

const KAVACH: Party = { name: "Kavach AI", role: "for Ganesh", avatar: "bot", tone: "bg-sun" };

// Three short scripted calls that loop: Agent Lab testing an agent, then the assistant
// calling someone for you, then it answering a scammer.
const SCENES: Scene[] = [
  {
    label: "Agent Lab · testing your agent on a noisy line",
    left: { name: "Test caller", role: "Kavach Agent Lab", avatar: "tester", tone: "bg-mint" },
    right: { name: "Your agent", role: "Screening bot", avatar: "bot", tone: "bg-sky" },
    beats: [
      { kind: "right", lang: "English", text: "Hi Pushkar! What is your current CTC?" },
      { kind: "left", lang: "Kannada", text: "ವರ್ಷಕ್ಕೆ ಆರೂವರೆ ಲಕ್ಷ.", meaning: "Six and a half lakh a year." },
      { kind: "note", text: "Noisy line · your agent heard “65,500”" },
      { kind: "right", lang: "English", text: "Got it — 65,500. Thanks, Pushkar!" },
      { kind: "stamp", tone: "bad", text: "Test failed · saved 65,500 for 6.5 lakh" },
    ],
  },
  {
    label: "Call for me · calling Pushkar",
    left: KAVACH,
    right: { name: "Pushkar", role: "Team member", avatar: "P", tone: "bg-rose" },
    beats: [
      { kind: "left", lang: "English", text: "Hi Pushkar! I'm Ganesh's AI assistant. Which language are you most comfortable in?" },
      { kind: "right", lang: "Kannada", text: "ಕನ್ನಡ ಆದರೆ ಒಳ್ಳೆಯದು.", meaning: "Kannada would be better." },
      { kind: "note", text: "Gnani detected Kannada · switched" },
      { kind: "left", lang: "Kannada", text: "ಸರಿ! ಗಣೇಶ್ ಹೇಳಿದ್ದಾರೆ: ಕ್ಲೈಂಟ್ ಡೆಕ್ ಇಂದು ಸಂಜೆಯೊಳಗೆ ಮುಗಿಸಿ.", meaning: "Ganesh says: finish the client deck by this evening." },
      { kind: "right", lang: "Kannada", text: "ಸರಿ, 5 ಗಂಟೆಗೆ ಕಳುಹಿಸುತ್ತೇನೆ.", meaning: "Sure, I'll send it by 5." },
      { kind: "stamp", tone: "good", text: "Pushkar agreed · by 5 PM" },
    ],
  },
  {
    label: "Call Guard · answering an unknown caller",
    left: KAVACH,
    right: { name: "Unknown caller", role: "+91 ••••• ••417", avatar: "?", tone: "bg-rose" },
    beats: [
      { kind: "left", lang: "English", text: "Hello, this is Ganesh's assistant. He's busy right now. May I know who's calling?" },
      { kind: "right", lang: "Hindi", text: "मैं बैंक से बोल रहा हूँ। जल्दी OTP बताइए, खाता बंद हो जाएगा।", meaning: "I'm from the bank. Tell me the OTP quickly or the account closes." },
      { kind: "note", text: "Gnani detected Hindi · switched" },
      { kind: "left", lang: "Hindi", text: "माफ़ कीजिए, मैं OTP या बैंक की जानकारी कभी नहीं देती।", meaning: "Sorry, I never share OTPs or bank details." },
      { kind: "stamp", tone: "bad", text: "Scam blocked · 95% risk" },
    ],
  },
];

const sceneAt = (i: number): Scene => SCENES[i % SCENES.length] as Scene;

const BEAT_MS = 2300;
const HOLD_MS = 3400;
// Show only the latest few lines so the card never jumps in height.
const VISIBLE_BEATS = 3;

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia(motionQuery);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

function Avatar({ party, speaking }: { party: Party; speaking: boolean }) {
  return (
    <span className="relative grid size-14 shrink-0 place-items-center sm:size-[72px]">
      {speaking && <><span className="talk-ring absolute inset-0 rounded-full border-2 border-ink/40" aria-hidden="true" /><span className="talk-ring talk-ring-late absolute inset-0 rounded-full border-2 border-ink/30" aria-hidden="true" /></>}
      <span className={cn("relative grid size-full place-items-center rounded-full border-2 border-ink-line text-ink shadow-sketch transition-transform duration-300", party.tone, speaking && "motion-safe:scale-105")}>
        {party.avatar === "bot" ? <Bot className="size-6 sm:size-8" aria-hidden="true" /> : party.avatar === "tester" ? <FlaskConical className="size-6 sm:size-8" aria-hidden="true" /> : <span className="text-xl font-black sm:text-2xl">{party.avatar}</span>}
      </span>
    </span>
  );
}

function Waves({ on }: { on: boolean }) {
  return (
    <span className={cn("flex h-5 items-center gap-[3px] transition-opacity", on ? "opacity-100" : "opacity-25")} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <span key={i} className={cn("h-full w-[3px] rounded-full bg-ink", on && "wave-bar")} style={{ animationDelay: `${i * 0.12}s` }} />)}
    </span>
  );
}

function PartyColumn({ party, speaking }: { party: Party; speaking: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar party={party} speaking={speaking} />
      <span className="text-center"><span className="block max-w-28 truncate text-sm font-bold text-ink">{party.name}</span><span className="block text-[11px] font-semibold text-secondary-text">{party.role}</span></span>
      <Waves on={speaking} />
    </div>
  );
}

/** The landing hero's live call: two parties talking, one scripted scene after another. Static under reduced motion. */
export default function HeroCallDemo() {
  const reduced = useSyncExternalStore(subscribe, () => window.matchMedia(motionQuery).matches, () => false);
  const [scene, setScene] = useState(0);
  const [shown, setShown] = useState(1);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let s = 0;
    let n = 1;
    let timer: number;
    const tick = () => {
      if (n < sceneAt(s).beats.length) {
        n += 1;
        setShown(n);
        timer = window.setTimeout(tick, n === sceneAt(s).beats.length ? HOLD_MS : BEAT_MS);
      } else {
        s = (s + 1) % SCENES.length;
        n = 1;
        setScene(s);
        setShown(1);
        setSeconds(0);
        timer = window.setTimeout(tick, BEAT_MS);
      }
    };
    timer = window.setTimeout(tick, BEAT_MS);
    const clock = window.setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(clock);
    };
  }, [reduced]);

  const current = sceneAt(reduced ? 0 : scene);
  const visible = current.beats.slice(0, reduced ? current.beats.length : shown);
  const last = [...visible].reverse().find((b) => b.kind === "left" || b.kind === "right");
  const speaking = last && (last.kind === "left" || last.kind === "right") ? last : null;
  const speaker = !reduced && speaking ? speaking.kind : null;
  const done = visible[visible.length - 1]?.kind === "stamp";
  const nameOf = (side: Side) => (side === "left" ? current.left : current.right).name;

  return (
    <div role="img" aria-label="Demo: Kavach's Agent Lab test caller answers a screening agent in Kannada on a noisy line and the agent saves the wrong salary, so the test fails; then Kavach's assistant calls Pushkar in Kannada; then it blocks a scammer asking for an OTP in Hindi." className="relative mx-auto w-full max-w-[880px] text-left">
      <div className="overflow-hidden rounded-[28px] border-2 border-ink-line bg-white shadow-sketch-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink/10 bg-paper px-4 py-3 sm:px-5">
          <span key={current.label} className="bubble-in inline-flex min-w-0 items-center gap-2 text-sm font-bold text-ink"><PhoneCall className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{current.label}</span></span>
          <span className="flex items-center gap-2">
            <span key={speaking?.lang ?? "English"} className="bubble-in inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-800"><Languages className="size-3.5" aria-hidden="true" />{speaking?.lang ?? "English"}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink/15 bg-white px-2.5 py-1 text-xs font-bold text-ink tabular-nums"><span className={cn("size-2 rounded-full", done ? "bg-slate-400" : "bg-emerald-500")} aria-hidden="true" />{done ? "Ended" : `0:${String(seconds % 60).padStart(2, "0")}`}</span>
          </span>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 pt-6 sm:gap-5 sm:px-8 sm:pt-7">
          <PartyColumn party={current.left} speaking={speaker === "left"} />
          <div className="relative flex h-full items-center" aria-hidden="true"><span className={cn("call-line h-1.5 w-full rounded-full", speaker === "right" && "call-line-reverse", done && "call-line-done")} /></div>
          <PartyColumn party={current.right} speaking={speaker === "right"} />
        </div>

        <ol className="flex h-[300px] flex-col justify-end gap-2.5 overflow-hidden px-4 pt-4 pb-5 [mask-image:linear-gradient(to_bottom,transparent,black_14%)] sm:h-[264px] sm:px-7">
          {visible.slice(-VISIBLE_BEATS).map((beat, i) => (
            <li key={`${scene}-${visible.length - Math.min(visible.length, VISIBLE_BEATS) + i}`} className={cn("bubble-in flex flex-col", beat.kind === "right" ? "items-end" : beat.kind === "left" ? "items-start" : "items-center")}>
              {beat.kind === "note" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800"><Languages className="size-3.5" aria-hidden="true" />{beat.text}</span>
              ) : beat.kind === "stamp" ? (
                <span className={cn("stamp stamp-in inline-flex items-center gap-2 rounded-xl border-[3px] bg-white px-4 py-1.5 text-sm font-black tracking-wide uppercase", beat.tone === "good" ? "border-emerald-700 text-emerald-800" : "border-red-700 text-red-700")}>
                  {beat.tone === "good" ? <Check className="size-5" aria-hidden="true" /> : <ShieldAlert className="size-5" aria-hidden="true" />}{beat.text}
                </span>
              ) : (
                <span className={cn("max-w-[86%] rounded-2xl border-2 px-3.5 py-2 text-[13px] leading-5 sm:max-w-[72%] sm:text-sm", beat.kind === "left" ? "rounded-bl-md border-ink/15 bg-sun-light text-ink" : "rounded-br-md border-ink/15 bg-rose-light text-ink")}>
                  <span className="mb-0.5 block text-[10px] font-extrabold tracking-[0.12em] text-secondary-text uppercase">{nameOf(beat.kind)} · {beat.lang}</span>
                  {beat.text}
                  {beat.meaning && <span className="mt-0.5 block text-[11px] leading-4 text-secondary-text italic">“{beat.meaning}”</span>}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
