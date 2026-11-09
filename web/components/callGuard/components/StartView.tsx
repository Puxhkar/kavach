"use client";

import { ArrowRight, FlaskConical, PhoneIncoming, PhoneOutgoing, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { AGENT_TESTING_ROUTE } from "@/components/agentTesting/agentTesting.constants";
import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";

import { CALL_GUARD_DRILL_ROUTE, CALL_GUARD_ERRANDS_ROUTE, CALL_GUARD_LIVE_ROUTE, CALL_GUARD_SETTINGS_ROUTE } from "../callGuard.constants";
import { useGetProfile } from "../hooks/useGuardProfile";

const CHOICES = [
  { href: CALL_GUARD_LIVE_ROUTE, icon: PhoneIncoming, title: "Answer a call", body: "Your assistant picks up, asks who's calling and why, and blocks scams.", tile: "bg-sun" },
  { href: CALL_GUARD_ERRANDS_ROUTE, icon: PhoneOutgoing, title: "Call someone for me", body: "Tell it who to call and what to say. It speaks their language and reports back.", tile: "bg-sky" },
  { href: CALL_GUARD_DRILL_ROUTE, icon: ShieldCheck, title: "Practise a scam call", body: "A fake scammer calls so you or your family can practise saying no.", tile: "bg-rose" },
];

/** Where "Get started" lands: four plain choices, nothing else to read. */
export default function StartView() {
  const { data: profile } = useGetProfile();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pt-4 sm:pt-8">
      <header className="flex flex-col gap-2">
        <p className="kicker">Get started</p>
        <Typography as="h1" size="heading2" fontWeight="bold">{profile?.ownerName ? `Hi ${profile.ownerName}, what would you like to do?` : "What would you like to do?"}</Typography>
        <Typography tone="muted" className="text-[15px]">Pick one. Everything happens in this browser, with your microphone.</Typography>
      </header>

      {/* The main product, on its own row. */}
      <Link href={AGENT_TESTING_ROUTE} className="group relative flex flex-col gap-5 overflow-hidden rounded-3xl border-2 border-ink bg-mint-light p-6 shadow-sketch transition-transform focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink motion-safe:hover:-translate-y-0.5 sm:flex-row sm:items-center sm:p-7">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-mint"><FlaskConical className="size-7 text-ink" aria-hidden="true" /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-2"><span className="text-2xl font-bold tracking-[-0.03em] text-ink">Test a voice agent</span><span className="rounded-full border-2 border-ink bg-sun px-2 py-0.5 text-[11px] font-black tracking-[0.12em] text-ink uppercase">Main</span></span>
          <span className="text-[15px] leading-6 text-[#334155]">Paste your agent&apos;s prompt. AI callers phone it in Indian languages, on noisy lines and with tricky requests — and show you what broke before it goes live.</span>
        </span>
        <span className="sketch-btn shrink-0 self-start bg-sun sm:self-center">Start testing<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
      </Link>

      <ul className="grid gap-4 sm:grid-cols-3">
        {CHOICES.map(({ href, icon: Icon, title, body, tile }) => (
          <li key={href}>
            <Link href={href} className="group flex h-full flex-col gap-4 rounded-3xl border-2 border-ink/15 bg-white p-5 transition-[border-color,box-shadow,transform] hover:border-ink hover:shadow-sketch focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink motion-safe:hover:-translate-y-0.5">
              <span className={cn("grid size-11 place-items-center rounded-2xl border-2 border-ink", tile)}><Icon className="size-5 text-ink" aria-hidden="true" /></span>
              <span className="flex flex-col gap-1.5">
                <span className="text-lg font-bold tracking-[-0.03em] text-ink">{title}</span>
                <span className="text-sm leading-6 text-secondary-text">{body}</span>
              </span>
              <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-ink">Start<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
            </Link>
          </li>
        ))}
      </ul>

      <Link href={CALL_GUARD_SETTINGS_ROUTE} className="inline-flex items-center gap-2 self-start text-sm font-semibold text-secondary-text hover:text-ink">
        <Settings className="size-4" aria-hidden="true" />Your name, free time and languages are in Settings
      </Link>
    </div>
  );
}
