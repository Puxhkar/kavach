"use client";

import { AlertCircle, PhoneOutgoing } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import PageIntro from "@/components/layout/PageIntro";
import { Button } from "@ui/components/ui/button";
import { EmptyState } from "@ui/components/ui/empty-state";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Typography } from "@ui/components/ui/typography";
import { cn } from "@ui/lib/utils";

import { errandBadge, timeAgo } from "../callGuard.constants";
import type { Errand } from "../callGuard.types";
import { useGetErrands } from "../hooks/useErrands";
import ErrandDetail from "./ErrandDetail";
import { LanguagePill } from "./GuardBadges";
import NewErrandCard from "./NewErrandCard";

function ErrandRow({ errand, selected, onSelect }: { errand: Errand; selected: boolean; onSelect: () => void }) {
  const badge = errandBadge(errand.status, errand.report?.outcome ?? null);
  return (
    <li>
      <button type="button" onClick={onSelect} aria-current={selected ? "true" : undefined} className="sketch-tile flex w-full cursor-pointer flex-col gap-1.5 p-3.5 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <span className="flex w-full items-start justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", badge.className)}>{badge.label}</span>
            <span className="truncate text-sm font-bold text-ink">{errand.recipientName}</span>
            {errand.recipientRole && <span className="truncate text-xs text-secondary-text">{errand.recipientRole}</span>}
          </span>
          <span className="shrink-0 text-xs text-secondary-text">{timeAgo(errand.createdAt)}</span>
        </span>
        <span className="line-clamp-1 text-sm text-[#334155]">{errand.task}</span>
        {(errand.language || errand.deadline) && (
          <span className="flex flex-wrap items-center gap-1.5">
            {errand.language && <LanguagePill language={errand.language} />}
            {errand.deadline && <span className="text-xs text-secondary-text">By {errand.deadline}</span>}
          </span>
        )}
      </button>
    </li>
  );
}

/** "Call for me": the assistant phones someone on the owner's behalf, in their language, and reports back. */
const LIST_LIMIT = 5;

export default function ErrandsView() {
  const { data, isPending, isError, error, refetch } = useGetErrands();
  const errands = data ?? [];
  const router = useRouter();
  const pathname = usePathname();
  // The open errand lives in ?errand= so reloads and shared links keep it.
  const requested = useSearchParams().get("errand");
  const detailRef = useRef<HTMLDivElement>(null);
  const selectedId = requested ?? errands[0]?.id ?? null;
  const [showAll, setShowAll] = useState(false);
  // Keep the list short; the open errand always stays visible.
  const listed = showAll || errands.findIndex((e) => e.id === selectedId) >= LIST_LIMIT ? errands : errands.slice(0, LIST_LIMIT);

  const select = (errandId: string) => {
    router.replace(`${pathname}?errand=${encodeURIComponent(errandId)}`, { scroll: false });
    // On a phone the detail is stacked under the list; bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-7">
      <PageIntro
        kicker="Call Guard"
        title="Call for me"
        description="Your assistant phones someone on your behalf, talks to them in the language they prefer, and tells you how it went."
      />

      <NewErrandCard onCreated={select} />

      {isPending ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]"><div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div><Skeleton className="h-96 w-full" /></div>
      ) : !data ? (
        <EmptyState variant="error" icon={<AlertCircle className="size-5" aria-hidden="true" />} title="Couldn't load your calls" description={error?.message} action={<Button variant="outlined" onClick={() => void refetch()}>Try again</Button>} />
      ) : !errands.length ? (
        <EmptyState icon={<PhoneOutgoing className="size-5" aria-hidden="true" />} title="No calls yet" description="Fill in “New call” above — who to call and what to tell them — and press Save. Then call them now or simulate the call." />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          {/* A failed background poll keeps the last good list on screen. */}
          <section aria-label="Calls for you" className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)]">
            <span className="panel-title">Your calls</span>
            {isError && <Typography size="paragraph3" tone="error" role="alert">Couldn&apos;t refresh. Showing the last list.</Typography>}
            <ul className="tilt-list flex min-h-0 flex-col gap-3 lg:-mx-2 lg:overflow-y-auto lg:px-2 lg:pt-1 lg:pb-3">
              {listed.map((errand) => <ErrandRow key={errand.id} errand={errand} selected={errand.id === selectedId} onSelect={() => select(errand.id)} />)}
            </ul>
            {errands.length > LIST_LIMIT && <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((v) => !v)}>{listed.length < errands.length ? `Show all ${errands.length} calls` : "Show fewer"}</Button>}
          </section>
          <div ref={detailRef} className="min-w-0 scroll-mt-32 lg:scroll-mt-4">
            {/* Keyed so the player, the live call and the simulate form reset when another errand is opened. */}
            {selectedId ? <ErrandDetail key={selectedId} errandId={selectedId} /> : <EmptyState title="Pick a call" description="Choose a call in the list to see its report and transcript." />}
          </div>
        </div>
      )}
    </div>
  );
}
