import { ArrowRight, Check, FileText, Headphones, Languages, ListChecks, PhoneCall, Users, Wrench, X } from "lucide-react";
import Link from "next/link";

import { AGENT_TESTING_ROUTE } from "@/components/agentTesting/agentTesting.constants";
import { cn } from "@ui/lib/utils";

// The Agent Lab story on the landing page: paste → simulate → see the failure → fix and
// re-run. Each step carries a small mock screen; the loops reuse the keyframes in globals.css.

function Step({ no, title, body, children, className }: { no: string; title: string; body: string; children: React.ReactNode; className?: string }) {
  return (
    <li className={cn("flex flex-col rounded-3xl border-2 border-ink-line bg-white p-5 shadow-board sm:p-6", className)}>
      <span className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-sun text-xs font-black text-ink">{no}</span>
        <h3 className="text-lg font-bold tracking-[-0.03em] text-ink">{title}</h3>
      </span>
      <p className="mt-2 text-sm leading-6 text-[#475569]">{body}</p>
      <div className="mt-4 flex-1">{children}</div>
    </li>
  );
}

function PromptMock() {
  return (
    <div className="rounded-2xl border-2 border-ink/15 bg-paper p-3.5 font-mono text-[12px] leading-5 text-ink" aria-hidden="true">
      <p className="mb-2 flex items-center gap-1.5 font-sans text-[11px] font-bold tracking-[0.12em] text-secondary-text uppercase"><FileText className="size-3.5" />Your prompt</p>
      <p>You are Meera, calling <span className="rounded bg-sky px-1">{"{{name}}"}</span> about the <span className="rounded bg-sky px-1">{"{{job_role}}"}</span> role.</p>
      <p>Ask current CTC, notice period…</p>
      <p>Never promise an offer.<span className="caret ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 bg-ink" /></p>
    </div>
  );
}

function SimulateMock() {
  const calls = [
    { name: "Hinglish → Kannada", lang: "Kannada", pass: true },
    { name: "Noisy phone line", lang: "Hindi", pass: false },
    { name: "Prompt injection", lang: "English", pass: true },
  ];
  return (
    <ul className="flex flex-col gap-2" aria-hidden="true">
      {calls.map((c, i) => (
        <li key={c.name} className="rounded-2xl border-2 border-ink/15 bg-paper px-3 py-2.5">
          <span className="flex items-center justify-between gap-2 text-xs font-bold text-ink">
            <span className="flex items-center gap-1.5"><PhoneCall className="size-3.5" />{c.name}</span>
            <span className="rounded-full border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-800">{c.lang}</span>
          </span>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200"><span className={cn("bar-fill block h-full rounded-full", c.pass ? "bg-emerald-500" : "bg-red-500")} style={{ animationDelay: `${i * 0.5}s` }} /></span>
        </li>
      ))}
    </ul>
  );
}

function FailureMock() {
  return (
    <div className="rounded-2xl border-2 border-red-200 bg-red-50/70 p-3.5 text-[13px] leading-5" aria-hidden="true">
      <p className="flex items-center gap-1.5 text-xs font-black tracking-wide text-red-700 uppercase"><X className="size-4" />Failed · Noisy phone line</p>
      <p className="mt-2 text-ink"><span className="font-bold">Caller:</span> “saadhe chhe lakh”</p>
      <p className="text-ink"><span className="font-bold">Agent heard:</span> “65,500”</p>
      <p className="text-ink"><span className="font-bold">Agent saved:</span> <span className="rounded bg-red-200/70 px-1 font-bold">65,500</span> without checking</p>
      <p className="mt-2 border-t border-red-200 pt-2 text-xs text-[#7f1d1d]"><span className="font-bold">Why it failed:</span> never read the amount back to confirm.</p>
    </div>
  );
}

function FixMock() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <div className="rounded-2xl border-2 border-ink/15 bg-paper p-3 font-mono text-[12px] leading-5">
        <p className="text-secondary-text">Never promise an offer.</p>
        <p className="rounded bg-emerald-100 px-1 text-emerald-900">+ Read every amount back and confirm it.</p>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5">
        <span className="text-xs font-bold text-ink">Re-run · v2</span>
        <span className="result-in inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-xs font-black whitespace-nowrap text-emerald-800" style={{ animationDelay: "1.2s" }}><Check className="size-3.5" />3 / 3 passed</span>
      </div>
    </div>
  );
}

const FACTS = [
  { icon: Languages, value: "10", label: "Indian languages, incl. mid-call switches" },
  { icon: Users, value: "15+", label: "tricky callers: silence, interruptions, wrong person, injection" },
  { icon: Headphones, value: "Every call", label: "recorded, with what your agent heard" },
  { icon: ListChecks, value: "Per rule", label: "pass or fail, with the reason" },
];

/** "Find where your agent fails — before production does." */
export default function LabSection() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border-2 border-ink-line mint-paper p-6 shadow-sketch-lg sm:p-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex max-w-2xl flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1 text-[11px] font-extrabold tracking-[0.16em] text-ink uppercase"><Wrench className="size-3.5" aria-hidden="true" />Agent Lab · the test lab</span>
          <h2 className="text-[clamp(2rem,4.6vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.045em] text-ink">Find where your agent fails — before production does.</h2>
          <p className="text-base leading-7 text-[#334155] sm:text-lg">Paste your voice agent&apos;s prompt and run simulated calls against it. AI callers behave like real ones — they switch languages, mumble on bad lines, stay silent, try to trick it. You see exactly where it broke and why, fix the prompt, and re-run until it passes. Then go live.</p>
        </div>
        <Link href={AGENT_TESTING_ROUTE} className="sketch-btn self-start bg-sun lg:self-end">Test your agent<ArrowRight className="size-4" aria-hidden="true" /></Link>
      </div>

      <ol className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Step no="1" title="Paste your prompt" body="That's the whole setup. Kavach works out what the agent must ask, collect and never do."><PromptMock /></Step>
        <Step no="2" title="Run simulated calls" body="AI callers phone your agent with real-world situations, in real Indian languages."><SimulateMock /></Step>
        <Step no="3" title="See where it fails" body="Every call is scored. Failures show what was said, what your agent heard and saved, and why."><FailureMock /></Step>
        <Step no="4" title="Fix and re-run" body="Change the prompt, run the same calls again, and ship only when every test passes."><FixMock /></Step>
      </ol>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map(({ icon: Icon, value, label }) => (
          <li key={label} className="flex items-start gap-3 rounded-2xl border-2 border-ink/10 bg-white/80 px-4 py-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
            <span className="flex flex-col"><span className="text-base font-black tracking-[-0.02em] text-ink">{value}</span><span className="text-xs leading-5 text-secondary-text">{label}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
