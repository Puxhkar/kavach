"use client";

import { AlertCircle, History, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import PageIntro from "@/components/layout/PageIntro";

import { Badge } from "@ui/components/ui/badge";
import { Button } from "@ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@ui/components/ui/card";
import { EmptyState } from "@ui/components/ui/empty-state";
import { InputField, SelectField } from "@ui/components/ui/input-field";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Typography } from "@ui/components/ui/typography";

import { drillRoute, timeAgo } from "../callGuard.constants";
import type { Drill } from "../callGuard.types";
import { isCallActive } from "../hooks/useCalls";
import { useGetDrills } from "../hooks/useDrills";
import { useGetProfile } from "../hooks/useGuardProfile";
import { useGetScenarios } from "../hooks/useGetScenarios";
import DrillResultView from "./DrillResultView";
import { LanguagePill, VerdictBadge } from "./GuardBadges";
import LiveCall from "./LiveCall";
import VoiceNote from "./VoiceNote";

const LIST_LIMIT = 4;

function PastDrills({ selectedId }: { selectedId: string | null }) {
  const { data: drills = [], isPending, isError } = useGetDrills();
  const [showAll, setShowAll] = useState(false);
  return (
    <Card tone="plain">
      <CardHeader><Typography as="h2" size="heading4" fontWeight="bold">Past drills</Typography><History className="size-5 text-secondary-text" aria-hidden="true" /></CardHeader>
      <CardContent className="px-3 sm:px-4">
        {isPending ? (
          <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : isError ? (
          <Typography size="paragraph3" tone="error" className="px-2">Couldn&apos;t load past drills.</Typography>
        ) : !drills.length ? (
          <Typography size="paragraph3" tone="muted" className="empty-paper px-3 py-6 text-center">No drills yet. Press “Start the drill” and your scorecard shows up here.</Typography>
        ) : (
          <>
          <ul className="flex flex-col gap-2">
            {(showAll ? drills : drills.slice(0, LIST_LIMIT)).map((drill: Drill) => (
              <li key={drill.id}>
                <Link href={drillRoute(drill.id)} aria-current={drill.id === selectedId ? "page" : undefined} className="sketch-tile flex items-center justify-between gap-3 px-3 py-2.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold text-ink">{drill.scamTitle}</span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {drill.language && <LanguagePill language={drill.language} />}
                      <span className="truncate text-xs text-secondary-text">{[drill.practicerName, timeAgo(drill.createdAt)].filter(Boolean).join(" · ")}</span>
                    </span>
                  </span>
                  {drill.result ? (
                    <span className="flex shrink-0 items-center gap-1.5"><span className="text-sm font-bold text-ink">{drill.result.score}</span><VerdictBadge verdict={drill.result.verdict} /></span>
                  ) : (
                    <Badge variant={isCallActive(drill.status) ? "primary" : "warning"}>{isCallActive(drill.status) ? "Scoring…" : "Not scored"}</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {drills.length > LIST_LIMIT && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${drills.length} drills`}</Button>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DrillSetup() {
  const router = useRouter();
  const { data: profile } = useGetProfile();
  const scenarios = useGetScenarios();
  const scams = scenarios.data?.scams ?? [];
  const [name, setName] = useState("");
  const [pickedLanguage, setPickedLanguage] = useState("");
  const [pickedScam, setPickedScam] = useState("");
  const language = pickedLanguage || profile?.language || "";
  const scamId = scams.some((s) => s.id === pickedScam) ? pickedScam : (scams[0]?.id ?? "");

  if (scenarios.isError) return <EmptyState variant="error" icon={<AlertCircle className="size-5" aria-hidden="true" />} title="Couldn't load the scam types" description={scenarios.error.message} action={<Button variant="outlined" onClick={() => void scenarios.refetch()}>Try again</Button>} />;

  return (
    <LiveCall
      startBody={{ kind: "drill", scamId, language: language || undefined, practicerName: name.trim() }}
      canStart={!!scamId}
      aiLabel="Scammer (AI)"
      startLabel="Start the drill"
      onFinished={(end) => router.push(drillRoute(end.id))}
      intro={
        <div className="note-box flex gap-3 border-red-200 bg-rose-light/70 p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" />
          <Typography size="paragraph2" tone="inherit" className="text-ink">An AI scammer will call you. Don&apos;t worry, it&apos;s practice — nothing is real. Do what you&apos;d really do.</Typography>
        </div>
      }
      setup={
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField id="drill-name" label="Who is practising?" placeholder="Mummy" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} hint="Used in the scorecard and the family message." />
            <SelectField id="drill-language" label="Language" value={language} onChange={(e) => setPickedLanguage(e.target.value)} disabled={!profile}>
              {(profile?.languages ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
            </SelectField>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-semibold text-ink">Scam type</legend>
            {scenarios.isPending ? (
              <div className="grid gap-2 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {scams.map((scam) => (
                  <label key={scam.id} className="sketch-tile flex cursor-pointer items-start gap-3 p-3.5 has-checked:border-ink has-checked:bg-sun-light has-checked:shadow-tile has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink">
                    <input type="radio" name="drill-scam" className="mt-1 size-4 accent-ink" checked={scam.id === scamId} onChange={() => setPickedScam(scam.id)} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-bold text-ink">{scam.title}</span>
                      <span className="text-xs leading-5 text-secondary-text">{scam.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </div>
      }
    />
  );
}

export default function DrillView() {
  const drillId = useSearchParams().get("drill");
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-7">
      <PageIntro
        kicker="Call Guard"
        title="Scam drill"
        description="Practise picking up a scam call, safely — an AI plays the scammer, and you get a scorecard to share with the family."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {drillId ? <DrillResultView key={drillId} drillId={drillId} /> : <><VoiceNote /><DrillSetup /></>}
        </div>
        <PastDrills selectedId={drillId} />
      </div>
    </div>
  );
}
