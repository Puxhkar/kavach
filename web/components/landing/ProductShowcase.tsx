import { ArrowRight, Bot, Check, FlaskConical, PhoneOutgoing, ShieldCheck, Star, X } from "lucide-react";
import Link from "next/link";

import { AGENT_TESTING_ROUTE } from "@/components/agentTesting/agentTesting.constants";
import { CALL_GUARD_DRILL_ROUTE, CALL_GUARD_ERRANDS_ROUTE, CALL_GUARD_ROUTE } from "@/components/callGuard/callGuard.constants";
import { cn } from "@ui/lib/utils";

// Every card carries a small looping demo. The keyframes live in globals.css and stop under reduced motion.

function Ribbon() {
  return <span className="absolute top-5 right-[-44px] w-44 rotate-45 border-y-2 border-ink-line bg-sun py-1 text-center text-[11px] font-black tracking-[0.18em] text-ink uppercase shadow-sm">Flagship</span>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 flex flex-col gap-2.5 text-[15px] leading-6 text-[#334155]">
      {items.map((b) => <li key={b} className="flex gap-2.5"><Check className="mt-0.5 size-5 shrink-0 rounded-full bg-ink p-0.5 text-white" aria-hidden="true" />{b}</li>)}
    </ul>
  );
}

function CardHead({ icon: Icon, kicker, name, iconClass }: { icon: typeof ShieldCheck; kicker: string; name: string; iconClass: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("icon-bob grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-ink shadow-sketch-sm", iconClass)}><Icon className="size-6" aria-hidden="true" /></span>
      <div><p className="text-[11px] font-extrabold tracking-[0.16em] text-secondary-text uppercase">{kicker}</p><h3 className="text-3xl font-bold tracking-[-0.045em]">{name}</h3></div>
    </div>
  );
}

/** Inbox rows that drop in one after another; the scam gets stamped. */
function InboxDemo() {
  const rows = [
    { tag: "Urgent", tagClass: "border-orange-300 bg-orange-100 text-orange-900", who: "Mom", what: "Papa has a high fever — call back ASAP", star: true },
    { tag: "High", tagClass: "border-blue-300 bg-sky text-blue-900", who: "Pushkar · TalentBridge", what: "Second-round interview slot", star: false },
    { tag: "Scam", tagClass: "border-red-300 bg-rose-light text-red-800", who: "“Inspector” Sharma", what: "Asked for bank details · 95% risk", star: false, scam: true },
  ];
  return (
    <ul className="mt-6 flex flex-col gap-2.5" aria-label="Example inbox">
      {rows.map((row, i) => (
        <li key={row.who} className="cascade-in relative rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 shadow-tile" style={{ animationDelay: `${i * 0.45}s` }}>
          <span className="flex flex-wrap items-center gap-2"><span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", row.tagClass)}>{row.tag}</span><span className="font-bold">{row.who}</span>{row.star && <Star className="twinkle size-4 fill-amber-400 text-amber-500" aria-label="VIP" />}</span>
          <span className="mt-1 block text-sm text-[#475569]">{row.what}</span>
          {row.scam && <span className="stamp-loop absolute top-1/2 right-3 -translate-y-1/2 -rotate-6 rounded-lg border-[3px] border-red-700 bg-white px-2 py-0.5 text-xs font-black tracking-wider text-red-700 uppercase">Blocked</span>}
        </li>
      ))}
    </ul>
  );
}

/** A test run: bars fill, then each test lands as pass or fail, under a scanning line. */
function LabDemo() {
  const tests = [
    { name: "Noisy phone line", pass: false, note: "Heard “65,500” for 6.5 lakh — saved it unconfirmed" },
    { name: "Hinglish → Kannada", pass: true, note: "Switched language, kept collecting answers" },
    { name: "Prompt injection", pass: true, note: "Refused to reveal its instructions" },
  ];
  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border-2 border-ink/15 bg-white p-4 shadow-tile" aria-label="Example test run">
      <span className="scan-line pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-emerald-200/0 via-emerald-200/50 to-emerald-200/0" aria-hidden="true" />
      <p className="flex items-center justify-between text-xs font-extrabold tracking-[0.12em] text-secondary-text uppercase"><span>Test run · Screening agent</span><span className="result-in rounded-full border border-ink/15 bg-mint px-2 py-0.5 text-ink" style={{ animationDelay: "2.6s" }}>2 / 3 passed</span></p>
      <ul className="mt-3 flex flex-col gap-3">
        {tests.map((t, i) => (
          <li key={t.name} className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between gap-2 text-sm font-bold text-ink">
              {t.name}
              <span className={cn("result-in inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold", t.pass ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-700")} style={{ animationDelay: `${0.9 + i * 0.6}s` }}>
                {t.pass ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}{t.pass ? "Pass" : "Fail"}
              </span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={cn("bar-fill block h-full rounded-full", t.pass ? "bg-emerald-500" : "bg-red-500")} style={{ animationDelay: `${i * 0.6}s` }} /></span>
            <span className="result-in text-xs text-[#475569]" style={{ animationDelay: `${0.9 + i * 0.6}s` }}>{t.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** An outgoing call rippling out while the greeting cycles through languages. */
function CallForMeDemo() {
  const hellos = ["Hello", "ನಮಸ್ಕಾರ", "வணக்கம்"];
  return (
    <div className="mt-5 flex items-center gap-4 rounded-2xl border-2 border-ink/15 bg-white px-4 py-3" aria-hidden="true">
      <span className="relative grid size-11 shrink-0 place-items-center">
        <span className="talk-ring absolute inset-0 rounded-full border-2 border-ink/30" />
        <span className="talk-ring talk-ring-late absolute inset-0 rounded-full border-2 border-ink/20" />
        <span className="relative grid size-full place-items-center rounded-full border-2 border-ink bg-sky"><PhoneOutgoing className="size-5" /></span>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs font-bold text-secondary-text">Calling Pushkar…</span>
        <span className="relative h-7 overflow-hidden text-lg font-bold text-ink">
          {hellos.map((h, i) => <span key={h} className="word-cycle absolute inset-0" style={{ animationDelay: `${i * 2}s` }}>{h}</span>)}
        </span>
      </span>
    </div>
  );
}

/** A safety meter filling to a full score. */
function DrillDemo() {
  return (
    <div className="mt-5 rounded-2xl border-2 border-ink/15 bg-white px-4 py-3" aria-hidden="true">
      <span className="flex items-center justify-between text-xs font-bold"><span className="text-secondary-text">Mummy · fake bank call</span><span className="result-in rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-800" style={{ animationDelay: "1.8s" }}>Stayed safe</span></span>
      <span className="mt-2 block h-2.5 overflow-hidden rounded-full border border-ink/15 bg-slate-100"><span className="bar-fill block h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500" /></span>
      <span className="mt-2 flex gap-3 text-xs text-[#334155]"><span className="result-in" style={{ animationDelay: "0.6s" }}>✓ No OTP</span><span className="result-in" style={{ animationDelay: "1s" }}>✓ Asked for ID</span><span className="result-in" style={{ animationDelay: "1.4s" }}>✓ Hung up</span></span>
    </div>
  );
}

export default function ProductShowcase() {
  return (
    <>
      {/* The main product: full width, the only flagship. */}
      <article className="hover-tilt relative mt-10 grid gap-8 overflow-hidden rounded-[28px] border-2 border-ink-line mint-paper p-6 shadow-sketch-lg sm:p-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <Ribbon />
        <div className="flex min-w-0 flex-col">
          <CardHead icon={FlaskConical} kicker="For anyone shipping a voice agent" name="Agent Lab" iconClass="bg-mint" />
          <p className="mt-4 text-lg leading-7 font-medium text-ink">Paste your agent&apos;s prompt. AI callers stress-test it the way real Indian callers will — and you see what broke before it goes live.</p>
          <Bullets items={["One step: paste the prompt, press run", "Callers switch languages, mumble on noisy lines, try prompt injection", "Every call scored: what it heard, what it saved, pass or fail"]} />
          <Link href={AGENT_TESTING_ROUTE} className="sketch-btn mt-7 self-start bg-sun">Test your agent<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
        <LabDemo />
      </article>

      <p className="mt-12 text-[11px] font-extrabold tracking-[0.16em] text-secondary-text uppercase">Also in Kavach · a personal call shield on the same voice</p>
      <div className="mt-4 grid gap-6 md:grid-cols-3">
        <article className="hover-tilt relative flex flex-col rounded-3xl border-2 border-ink-line yellow-paper p-6 shadow-board">
          <CardHead icon={ShieldCheck} kicker="When you're busy" name="Call Guard" iconClass="bg-sun" />
          <p className="mt-3 font-medium text-ink">Answers your calls, speaks the caller&apos;s language and blocks scams.</p>
          <InboxDemo />
          <Link href={CALL_GUARD_ROUTE} className="sketch-btn mt-6 min-h-11 self-start bg-white text-sm">Try it<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </article>
        <article className="hover-tilt relative flex flex-col rounded-3xl border-2 border-ink-line blueprint-card p-6 shadow-board">
          <CardHead icon={PhoneOutgoing} kicker="Errands" name="Call for me" iconClass="bg-white" />
          <p className="mt-3 font-medium text-ink">Phones people for you — in their language — and reports back.</p>
          <CallForMeDemo />
          <Link href={CALL_GUARD_ERRANDS_ROUTE} className="sketch-btn mt-6 min-h-11 self-start bg-white text-sm">Try it<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </article>
        <article className="hover-tilt relative flex flex-col rounded-3xl border-2 border-ink-line rose-paper p-6 shadow-board">
          <CardHead icon={Bot} kicker="For family" name="Scam Drill" iconClass="bg-white" />
          <p className="mt-3 font-medium text-ink">A fake scammer calls so your parents can practise saying no.</p>
          <DrillDemo />
          <Link href={CALL_GUARD_DRILL_ROUTE} className="sketch-btn mt-6 min-h-11 self-start bg-white text-sm">Try it<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </article>
      </div>
    </>
  );
}
