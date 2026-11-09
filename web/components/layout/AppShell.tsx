"use client";

import { ArrowLeft, FlaskConical, LayoutGrid, PhoneIncoming, PhoneOutgoing, Settings, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AGENT_TESTING_ROUTE } from "@/components/agentTesting/agentTesting.constants";
import {
  CALL_GUARD_DRILL_ROUTE,
  CALL_GUARD_ERRANDS_ROUTE,
  CALL_GUARD_LIVE_ROUTE,
  CALL_GUARD_ROUTE,
  CALL_GUARD_SETTINGS_ROUTE,
} from "@/components/callGuard/callGuard.constants";
import { cn } from "@ui/lib/utils";

import BrandMark from "./BrandMark";

const NAV = [
  { href: CALL_GUARD_ROUTE, label: "Start", icon: LayoutGrid },
  { href: AGENT_TESTING_ROUTE, label: "Agent Lab", icon: FlaskConical },
  { href: CALL_GUARD_LIVE_ROUTE, label: "Answer calls", icon: PhoneIncoming },
  { href: CALL_GUARD_ERRANDS_ROUTE, label: "Call for me", icon: PhoneOutgoing },
  { href: CALL_GUARD_DRILL_ROUTE, label: "Scam drill", icon: ShieldAlert },
  { href: CALL_GUARD_SETTINGS_ROUTE, label: "Settings", icon: Settings },
];

function isActive(href: string, pathname: string) {
  // Start owns only itself; Agent Lab owns all of its own pages.
  if (href === CALL_GUARD_ROUTE) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3 rounded-2xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink" aria-label="Kavach home">
      <BrandMark className={compact ? "size-9" : "size-11"} />
      <span className="flex min-w-0 flex-col">
        <span className={cn("font-serif leading-none font-semibold tracking-[-0.03em] text-ink", compact ? "text-xl" : "text-2xl")}>Kavach</span>
        <span className="mt-1 truncate text-[10px] font-extrabold tracking-[0.16em] text-secondary-text uppercase">Voice-agent testing</span>
      </span>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh md:gap-6 md:p-5">
      <aside className="sticky top-5 hidden h-[calc(100dvh-2.5rem)] w-64 shrink-0 flex-col overflow-y-auto rounded-3xl border-2 border-ink paper-card px-4 py-5 shadow-board md:flex">
        <div className="px-1"><BrandLockup /></div>
        <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  active ? "bg-ink text-white" : "text-ink hover:bg-ink/5",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-6">
          <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-secondary-text hover:bg-ink/5 hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" />Back to website</Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones: a sticky sketch bar with the brand and every page as a scrollable chip strip. */}
        <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
            <BrandLockup compact />
            <Link href="/" className="flex shrink-0 items-center gap-1 text-xs font-bold text-ink underline decoration-sun decoration-2 underline-offset-4"><ArrowLeft className="size-3.5" aria-hidden="true" />Website</Link>
          </div>
          <nav aria-label="Main" className="flex gap-2 overflow-x-auto px-4 pt-1 pb-3 [scrollbar-width:none]">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(href, pathname);
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined} className="dash-tab shrink-0 px-3 py-1.5 text-sm whitespace-nowrap">
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="min-w-0 flex-1 px-4 pt-5 pb-10 md:px-4 md:pt-6">{children}</main>
      </div>
    </div>
  );
}
