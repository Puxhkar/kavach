import { ArrowRight, Cpu, Languages, Lock, Mic, ShieldAlert, Sparkles, Star, Volume2 } from "lucide-react";
import Link from "next/link";

import { AGENT_TESTING_ROUTE } from "@/components/agentTesting/agentTesting.constants";
import { CALL_GUARD_DRILL_ROUTE, CALL_GUARD_ERRANDS_ROUTE, CALL_GUARD_ROUTE } from "@/components/callGuard/callGuard.constants";
import HeroCallDemo from "@/components/landing/HeroCallDemo";
import LabSection from "@/components/landing/LabSection";
import ProductShowcase from "@/components/landing/ProductShowcase";
import Reveal from "@/components/landing/Reveal";
import BrandMark from "@/components/layout/BrandMark";
import { cn } from "@ui/lib/utils";

const NAV = [
  { href: "#lab", label: "Agent Lab" },
  { href: "#products", label: "Products" },
  { href: "#languages", label: "Languages" },
  { href: "#safety", label: "Safety" },
];

const LANGUAGES = [
  { name: "English", hello: "Hello" },
  { name: "Hindi", hello: "नमस्ते" },
  { name: "Kannada", hello: "ನಮಸ್ಕಾರ" },
  { name: "Tamil", hello: "வணக்கம்" },
  { name: "Telugu", hello: "నమస్కారం" },
  { name: "Malayalam", hello: "നമസ്കാരം" },
  { name: "Marathi", hello: "नमस्कार" },
  { name: "Bengali", hello: "নমস্কার" },
  { name: "Gujarati", hello: "નમસ્તે" },
];

const RULES = [
  { icon: Lock, title: "Never shares OTPs, PINs or bank details", body: "Not to the “bank”, not to the “police”, not to anyone. It's a hard rule, whatever the caller says." },
  { icon: ShieldAlert, title: "Scams at 70% risk or more are blocked", body: "Every call gets a scam-risk score with the red flags it heard. High-risk calls never reach you." },
  { icon: Star, title: "VIPs first", body: "Family and the people you mark as VIP get a star and go to the top of your inbox." },
];

const POWERED = [
  { icon: Mic, name: "Gnani Prisma", role: "Speech-to-text with language detection" },
  { icon: Volume2, name: "Gnani Timbre", role: "Natural text-to-speech voices" },
  { icon: Cpu, name: "Local AI model", role: "Runs the conversation and writes the summary" },
];

const pill = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold tracking-wide transition-[transform,background-color] focus-visible:outline-3 focus-visible:outline-offset-3 motion-safe:hover:-translate-y-0.5";

function SectionHead({ kicker, title, body, center = false }: { kicker: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", center && "mx-auto items-center text-center")}>
      <span className="inline-flex w-fit items-center rounded-full border-2 border-ink/15 bg-white px-3 py-1 text-[11px] font-extrabold tracking-[0.16em] text-ink uppercase">{kicker}</span>
      <h2 className="text-[clamp(2rem,4.6vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.045em] text-ink">{title}</h2>
      {body && <p className="text-base leading-7 text-[#475569] sm:text-lg">{body}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/85 backdrop-blur-md">
        <nav aria-label="Site" className="mx-auto flex h-16 w-[min(1240px,calc(100vw-32px))] items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Kavach home">
            <BrandMark className="size-9" />
            <span className="text-xl font-bold tracking-[-0.04em] text-ink">Kavach</span>
          </Link>
          <ul className="hidden items-center gap-8 lg:flex">
            {NAV.map((item) => <li key={item.href}><a href={item.href} className="text-xs font-bold tracking-[0.14em] text-[#334155] uppercase hover:text-ink">{item.label}</a></li>)}
          </ul>
          <div className="flex items-center gap-4">
            <Link href={CALL_GUARD_ROUTE} className="hidden text-sm font-semibold text-ink hover:underline sm:inline">Open app</Link>
            <Link href={CALL_GUARD_ROUTE} className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-xs font-bold tracking-[0.12em] text-white uppercase hover:bg-primary-500 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink">Get started</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero: the promise on the left, a live two-party call on the right, two ribbons below. */}
        <section className="relative overflow-hidden border-b border-ink/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_10%,rgba(253,224,71,0.35),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(147,197,253,0.35),transparent_34%),radial-gradient(circle_at_70%_90%,rgba(245,209,218,0.4),transparent_34%)]" aria-hidden="true" />
          <div className="relative mx-auto grid w-[min(1240px,calc(100vw-32px))] items-center gap-12 pt-14 pb-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:pt-20 lg:pb-20">
            <div className="flex flex-col items-start text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-[11px] font-extrabold tracking-[0.16em] text-ink uppercase"><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />The voice-agent testing lab</span>
              <h1 className="mt-6 text-[clamp(2.6rem,5.6vw,4.75rem)] leading-[1.02] font-bold tracking-[-0.05em] text-ink">
                Test your voice agent before it meets <span className="marker">real callers.</span>
              </h1>
              <p className="mt-6 max-w-[54ch] text-base leading-7 text-[#334155] sm:text-lg sm:leading-8">
                Paste your agent&apos;s prompt. Kavach&apos;s AI callers phone it in Indian languages, on noisy lines and with tricky requests — and show you exactly where it broke, before your customers find out.
              </p>
              <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link href={AGENT_TESTING_ROUTE} className="sketch-btn bg-sun">Test your agent<ArrowRight className="size-4" aria-hidden="true" /></Link>
                <a href="#lab" className="sketch-btn bg-white">See how it works</a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-secondary-text">
                <li className="flex items-center gap-2"><Sparkles className="size-4 text-ink" aria-hidden="true" />Just paste a prompt</li>
                <li className="flex items-center gap-2"><Languages className="size-4 text-ink" aria-hidden="true" />9 Indian languages</li>
                <li className="flex items-center gap-2"><Mic className="size-4 text-ink" aria-hidden="true" />Gnani speech</li>
              </ul>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute -inset-3 rotate-2 rounded-[32px] bg-sun/60 motion-reduce:rotate-0" aria-hidden="true" />
              <div className="relative"><HeroCallDemo /></div>
            </div>
          </div>

          {/* Two ribbons: what it does, and the languages it speaks. */}
          <div className="relative pb-10" aria-hidden="true">
            <div className="overflow-hidden border-y-2 border-ink-line bg-sun">
              <div className="marquee-track text-sm text-ink sm:text-base">
                {[0, 1].flatMap((n) => ["Multilingual", "Scam shield", "Calls on your behalf", "Scam drills", "Agent Lab", "Gnani speech"].map((item) => <span key={`${n}-${item}`} className="flex items-center gap-10">{item}<span className="text-ink/40">✦</span></span>))}
              </div>
            </div>
            <div className="mt-5 overflow-hidden">
              <div className="marquee-track marquee-reverse gap-4 py-2 font-normal tracking-normal normal-case">
                {[0, 1].flatMap((n) => LANGUAGES.map((l) => (
                  <span key={`${n}-${l.name}`} className="flex shrink-0 items-center gap-2.5 rounded-2xl border-2 border-ink-line bg-white px-4 py-2 shadow-[3px_3px_0_#0f172a]">
                    <span className="text-lg font-semibold text-ink">{l.hello}</span>
                    <span className="text-xs font-bold tracking-[0.1em] text-secondary-text uppercase">{l.name}</span>
                  </span>
                )))}
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-[min(1240px,calc(100vw-32px))]">
          {/* Agent Lab: what the test lab is for, step by step. */}
          <Reveal id="lab" className="scroll-mt-24 pt-16 sm:pt-20">
            <LabSection />
          </Reveal>

          {/* Products */}
          <Reveal id="products" className="scroll-mt-24 pt-20 sm:pt-28">
            <SectionHead kicker="Products" title="Built to test voice agents." body="Agent Lab is the heart of Kavach. The same voices, languages and safety rules also power a personal call shield." />
            <ProductShowcase />
          </Reveal>

          {/* Languages */}
          <Reveal id="languages" className="scroll-mt-24 pt-20 sm:pt-28">
            <div className="grid items-center gap-10 overflow-hidden rounded-[28px] border-2 border-ink-line blueprint-card p-6 shadow-board sm:p-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <SectionHead kicker="Languages" title="Speak your language. It replies in it." body="Gnani's Prisma speech-to-text detects the language you speak — even when you switch mid-call — and the assistant answers in the same language." />
              <ul className="flex flex-wrap gap-3">
                {LANGUAGES.map((l, i) => (
                  <li key={l.name} className={cn("flex items-center gap-2.5 rounded-2xl border-2 border-ink-line bg-white px-4 py-2.5 shadow-[3px_3px_0_#0f172a] motion-reduce:rotate-0", i % 3 === 0 ? "-rotate-1" : i % 3 === 1 ? "rotate-1" : "")}>
                    <span className="text-lg font-semibold text-ink">{l.hello}</span>
                    <span className="text-xs font-bold tracking-[0.1em] text-secondary-text uppercase">{l.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Safety */}
          <Reveal id="safety" className="scroll-mt-24 pt-20 sm:pt-28">
            <div className="relative grid gap-10 overflow-hidden rounded-[28px] bg-ink p-6 text-white shadow-[0_30px_80px_rgba(16,33,58,0.25)] sm:rounded-[36px] sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(253,224,71,0.14),transparent_40%)]" aria-hidden="true" />
              <div className="relative">
                <span className="inline-flex items-center rounded-full border border-white/20 px-3 py-1 text-[11px] font-extrabold tracking-[0.16em] text-white/85 uppercase">Safety</span>
                <h2 className="mt-4 text-[clamp(2rem,4.6vw,3.25rem)] leading-[1.02] font-bold tracking-[-0.045em]">Hard rules it never breaks.</h2>
                <ul className="mt-8 flex flex-col gap-5">
                  {RULES.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sun text-ink"><Icon className="size-5" aria-hidden="true" /></span>
                      <span><span className="block text-lg font-bold">{title}</span><span className="mt-1 block text-sm leading-6 text-white/75">{body}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative rounded-3xl border-2 border-ink-line bg-paper p-5 text-ink shadow-[8px_8px_0_rgba(0,0,0,0.35)] sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">“Inspector” Rajesh Sharma</span>
                  <span className="rounded-full border border-red-300 bg-rose-light px-2.5 py-0.5 text-xs font-bold text-red-800">Scam blocked</span>
                </div>
                <p className="mt-1 text-sm text-secondary-text">Claimed a parcel with drugs in your name</p>
                <div className="mt-5 flex items-baseline justify-between"><span className="text-sm font-semibold">Scam risk</span><span className="text-sm font-bold text-red-700">95%</span></div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-ink bg-white"><div className="h-full w-[95%] bg-red-500" /></div>
                <p className="mt-5 text-[11px] font-extrabold tracking-[0.14em] text-secondary-text uppercase">Red flags it heard</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink">
                  {["Pretends to be the police", "Threatens a “digital arrest”", "Asks for bank details to “verify”"].map((f) => <li key={f} className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-700" aria-hidden="true" />{f}</li>)}
                </ul>
              </div>
            </div>
          </Reveal>

          {/* Powered by */}
          <Reveal className="pt-20 sm:pt-28">
            <SectionHead kicker="Under the hood" title="Powered by Gnani speech and a local AI model." center />
            <ul className="mt-10 grid gap-5 sm:grid-cols-3">
              {POWERED.map(({ icon: Icon, name, role }) => (
                <li key={name} className="flex items-center gap-4 rounded-3xl border-2 border-ink-line bg-white p-5 shadow-board">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-sky"><Icon className="size-5" aria-hidden="true" /></span>
                  <span><span className="block font-bold">{name}</span><span className="block text-sm leading-5 text-[#475569]">{role}</span></span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* Final CTA */}
          <Reveal className="pt-20 sm:pt-28">
            <div className="relative flex flex-col items-start justify-between gap-6 overflow-hidden rounded-[28px] border-2 border-ink-line bg-sun p-7 shadow-sketch-lg sm:p-10 lg:flex-row lg:items-center">
              <span className="pointer-events-none absolute -top-10 -right-10 hidden size-48 rounded-full sm:block border-2 border-dashed border-ink/25" aria-hidden="true" />
              <div className="relative max-w-2xl">
                <h2 className="text-[clamp(2rem,4.4vw,3rem)] leading-[1.02] font-bold tracking-[-0.045em] text-ink">Test your agent in five minutes.</h2>
                <p className="mt-3 text-base leading-7 text-ink sm:text-lg">Paste the prompt, press run, and watch three AI callers try to break it. No phone number or vendor account needed.</p>
              </div>
              <div className="relative flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link href={AGENT_TESTING_ROUTE} className={cn(pill, "bg-ink text-white hover:bg-primary-500 focus-visible:outline-ink")}>Test your agent<ArrowRight className="size-4" aria-hidden="true" /></Link>
                <Link href={CALL_GUARD_ROUTE} className={cn(pill, "border-2 border-ink bg-white text-ink hover:bg-paper focus-visible:outline-ink")}>See everything</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </main>

      <footer className="mx-auto mt-20 w-[min(1240px,calc(100vw-32px))] border-t-2 border-ink/10 py-10">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Kavach home"><BrandMark className="size-8" /><span className="text-lg font-bold tracking-[-0.04em]">Kavach</span></Link>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#334155]">
            <li><Link href={CALL_GUARD_ROUTE} className="hover:text-ink hover:underline">Call Guard</Link></li>
            <li><Link href={CALL_GUARD_ERRANDS_ROUTE} className="hover:text-ink hover:underline">Call for me</Link></li>
            <li><Link href={CALL_GUARD_DRILL_ROUTE} className="hover:text-ink hover:underline">Scam Drill</Link></li>
            <li><Link href={AGENT_TESTING_ROUTE} className="hover:text-ink hover:underline">Agent Lab</Link></li>
          </ul>
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-secondary-text"><Languages className="size-3.5" aria-hidden="true" />Speech by Gnani · conversations by a local AI model · calls run in your browser today</p>
      </footer>
    </div>
  );
}
