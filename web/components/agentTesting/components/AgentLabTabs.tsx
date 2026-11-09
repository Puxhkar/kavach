"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@ui/lib/utils";

import { AGENT_TESTING_ROUTE } from "../agentTesting.constants";

const TABS = [
  { href: AGENT_TESTING_ROUTE, label: "Test an agent" },
  { href: "/agent-testing/tests", label: "Run tests" },
  { href: "/agent-testing/calls", label: "Results" },
  { href: "/agent-testing/manual-call", label: "Manual call" },
];

function isActive(href: string, pathname: string) {
  // "Test an agent" also owns the agent setup pages.
  if (href === AGENT_TESTING_ROUTE) return pathname === href || pathname.startsWith(`${href}/agents`);
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Agent Lab's own sections, so the main sidebar needs just one entry for it. */
export default function AgentLabTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Agent Lab" className="mx-auto mb-6 flex w-full max-w-6xl gap-1 overflow-x-auto rounded-2xl border-2 border-ink/10 bg-white p-1.5 [scrollbar-width:none]">
      {TABS.map(({ href, label }) => {
        const active = isActive(href, pathname);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("shrink-0 rounded-xl px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink", active ? "bg-ink text-white" : "text-ink hover:bg-ink/5")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
