"use client";

import { AlertCircle, AudioLines, Loader2, MessagesSquare, PhoneCall, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@ui/components/ui/card";
import { EmptyState } from "@ui/components/ui/empty-state";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Typography } from "@ui/components/ui/typography";
import { agentRoute } from "../agentTesting.constants";
import type { AgentSummary, RunMode } from "../agentTesting.types";
import { useGetAgents } from "../hooks/useGetAgents";
import { useGetAgent } from "../hooks/useGetAgent";
import { useGetSituations } from "../hooks/useGetSituations";
import { useStartRun } from "../hooks/useRuns";
import PageHeader from "./PageHeader";
import RunResultsView from "./RunResultsView";

type View = "tests" | "calls" | "manual";
function AgentSelect({ agents, value, onChange }: { agents: AgentSummary[]; value: string; onChange: (id: string) => void }) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
      Agent
      <select
        aria-label="Select agent"
        className="h-10 max-w-64 min-w-0 cursor-pointer px-3 font-medium rounded-xl border-2 border-ink/25 bg-white text-sm text-ink hover:border-ink/45 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-sun/70 focus-visible:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
      </select>
    </label>
  );
}

function NoAgentsState() {
  return (
    <EmptyState
      icon={<AlertCircle className="size-5" aria-hidden="true" />}
      title="Set up an agent first"
      description="Add the calling agent, paste its prompt, and define the candidate questions before preparing tests."
      action={<Link href="/agent-testing/agents/new" className={buttonVariants({ variant: "contained" })}>Set up an agent</Link>}
    />
  );
}

function SetupConnectionNote() {
  return (
    <div className="note-box flex gap-3 border-amber-300 bg-amber-50/90 p-4 text-amber-950">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <Typography fontWeight="bold" tone="inherit">Chat and voice tests work; real phone calls are not connected yet</Typography>
        <Typography size="paragraph3" tone="inherit" className="text-amber-900">
          Test runs play your saved prompt against an AI candidate and score every conversation. Voice tests speak both sides and keep a recording. Calling the deployed agent and the manual call need the Plivo and Vapi QA accounts.
        </Typography>
      </div>
    </div>
  );
}

const DEFAULT_SELECTION = ["ctc-monthly-variable", "silence", "callback"];

const MODES: { value: RunMode; label: string; description: string; icon: typeof AudioLines }[] = [
  { value: "voice", label: "Voice", description: "Both sides are spoken and recorded. The agent hears the candidate through speech recognition, so mishearing shows up.", icon: AudioLines },
  { value: "chat", label: "Chat", description: "Text only. Faster; tests what the agent says and saves.", icon: MessagesSquare },
];

function TestRunsView({ agents, agentId, onAgentChange }: { agents: AgentSummary[]; agentId: string; onAgentChange: (id: string) => void }) {
  const agent = agents.find((item) => item.id === agentId) ?? agents[0];
  const router = useRouter();
  const { data: agentDetails } = useGetAgent(agent?.id);
  const situationsQuery = useGetSituations(agent?.id);
  const cases = situationsQuery.data?.situations ?? [];
  const maxConversations = situationsQuery.data?.maxConversationsPerRun ?? 0;
  const voiceAvailable = situationsQuery.data?.voiceAvailable ?? false;
  const [pickedMode, setPickedMode] = useState<RunMode | null>(null);
  // Voice is the default whenever the service has a Gnani key; without one only chat runs.
  const mode: RunMode = voiceAvailable ? (pickedMode ?? "voice") : "chat";
  const startRun = useStartRun();
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTION);
  const [repeats, setRepeats] = useState("1");
  // A language case picked for one agent may not exist for the next one, and voice-only cases can't run in chat; count only playable cases.
  const playable = (item: (typeof cases)[number]) => mode === "voice" || !item.voiceOnly;
  const selectedIds = cases.filter((item) => playable(item) && selected.includes(item.id)).map((item) => item.id);
  const planned = selectedIds.length * Number(repeats);
  const overLimit = planned > maxConversations;
  const canRun = !!agent && planned > 0 && !overLimit && !startRun.isPending;

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const run = () => {
    if (!agent) return;
    startRun.mutate(
      { agentId: agent.id, situationIds: selectedIds, repeats: Number(repeats), mode },
      {
        onSuccess: (created) => router.push(`/agent-testing/calls?agent=${encodeURIComponent(agent.id)}&run=${encodeURIComponent(created.id)}`),
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader
        crumbs={[{ label: "Agent testing", href: "/agent-testing" }, { label: "Edge-case testing" }]}
        title="Edge-case testing"
        description="Throw tricky callers at your agent — noisy lines, language switches, off-script answers — and see which ones it handles."
        actions={<AgentSelect agents={agents} value={agent?.id ?? ""} onChange={onAgentChange} />}
      />
      <SetupConnectionNote />
      {agent && <div className="yellow-paper relative flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-ink px-5 py-4 pr-24 shadow-board max-sm:pr-5">
        <div className="min-w-0"><p className="panel-title">Testing</p><Typography as="h2" size="heading3" fontWeight="bold" className="break-words">{agent.name}</Typography><Typography size="paragraph3" tone="muted">{agent.answersCount} candidate questions · {agent.promptVersion ? `prompt v${agent.promptVersion}` : "prompt not saved"}</Typography></div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/agent-testing/calls?agent=${encodeURIComponent(agent.id)}`} className={buttonVariants({ variant: "quiet", size: "sm" })}><MessagesSquare aria-hidden="true" />Past runs</Link>
          <Link href={agentRoute(agent.id, "describe")} className={buttonVariants({ variant: "quiet", size: "sm" })}>Edit prompt and questions</Link>
        </div>
      </div>}
      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Card tone="plain" className="xl:col-span-2">
          <CardHeader><div><Typography as="h2" size="heading4" fontWeight="bold">Candidate edge cases</Typography><Typography size="paragraph3" tone="muted">Select the situations to include in the test run.</Typography></div>{cases.length > 0 && <Button variant="text" size="sm" onClick={() => setSelected(cases.map((item) => item.id))}>Select all</Button>}</CardHeader>
          <CardContent className="tilt-list flex flex-col gap-2.5">
            {situationsQuery.isPending && [0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
            {situationsQuery.isError && <EmptyState variant="error" icon={<AlertCircle className="size-5" aria-hidden="true" />} title="Couldn't load the situations" action={<Button variant="outlined" onClick={() => void situationsQuery.refetch()}>Try again</Button>} />}
            {situationsQuery.isSuccess && !cases.length && agent && <EmptyState icon={<AlertCircle className="size-5" aria-hidden="true" />} title="Describe this agent first" description="Paste the prompt and list the answers it must collect. The situations are built from that." action={<Link href={agentRoute(agent.id, "describe")} className={buttonVariants({ variant: "contained" })}>Describe the agent</Link>} />}
            {cases.map((item) => <label key={item.id} className={`sketch-tile flex items-start gap-3 p-3 has-checked:border-ink has-checked:bg-sun-light has-checked:shadow-tile has-checked:rotate-0 has-focus-visible:ring-4 has-focus-visible:ring-sun/70 ${playable(item) ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
              <input type="checkbox" className="mt-1 size-4 shrink-0 accent-ink" checked={playable(item) && selected.includes(item.id)} disabled={!playable(item)} onChange={() => toggle(item.id)} />
              <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">{item.title}<span className="rounded-full border border-ink/15 bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted">{item.category}</span>{item.voiceOnly && <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">Voice runs only</span>}</span><span className="text-xs leading-5 text-secondary-text">{item.description}</span></span>
              {item.language && <span className="shrink-0 rounded-full border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800">{item.language}</span>}
            </label>)}
          </CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-dashed border-ink/12 px-5 py-3 text-xs font-semibold text-secondary-text sm:px-6"><span>{selectedIds.length} cases selected</span><span className={overLimit ? "font-bold text-red-700" : undefined}>{planned} conversations planned{maxConversations > 0 && ` · limit ${maxConversations}`}</span></div>
        </Card>
        <div className="flex flex-col gap-5">
          <Card tone="blue">
            <CardHeader><div><Typography as="h2" size="heading4" fontWeight="bold">Run options</Typography><Typography size="paragraph3" tone="muted">How the AI candidate is played.</Typography></div><MessagesSquare className="size-5 text-ink" aria-hidden="true" /></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2.5 text-sm font-semibold text-ink">
                <legend className="mb-1.5">Mode</legend>
                {MODES.map((option) => {
                  const disabled = option.value === "voice" && !voiceAvailable;
                  const Icon = option.icon;
                  return (
                    <label key={option.value} className={`sketch-tile flex items-start gap-3 p-3 has-checked:border-ink has-checked:bg-sun-light has-checked:shadow-tile has-checked:rotate-0 has-focus-visible:ring-4 has-focus-visible:ring-sun/70 ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                      <input type="radio" name="run-mode" className="mt-1 size-4 shrink-0 accent-ink" value={option.value} checked={mode === option.value} disabled={disabled} onChange={() => setPickedMode(option.value)} />
                      <span className="flex min-w-0 flex-col gap-0.5"><span className="flex items-center gap-1.5 font-bold"><Icon className="size-4 text-ink" aria-hidden="true" />{option.label}</span><span className="text-xs font-normal leading-5 text-secondary-text">{disabled ? "Add GNANI_API_KEY to services/narada/.env and restart the service to turn this on." : option.description}</span></span>
                    </label>
                  );
                })}
              </fieldset>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">Repeat each case<select value={repeats} onChange={(e) => setRepeats(e.target.value)} className="h-11 cursor-pointer px-3 font-normal rounded-xl border-2 border-ink/25 bg-white text-sm text-ink hover:border-ink/45 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-sun/70 focus-visible:outline-none"><option value="1">Once</option><option value="3">3 times</option><option value="5">5 times</option></select><span className="text-xs font-normal text-secondary-text">Each repeat gets a different candidate. Repeats expose inconsistent agent behavior.</span></label>
              <div className="note-box bg-white/80 p-3 text-xs leading-5 text-ink-muted">Selected language cases use the languages saved for this agent. Switching behavior: <b>{agentDetails?.definition?.languageSwitch ?? "follow"}</b>.</div>
            </CardContent>
            <div className="border-t-2 border-dashed border-ink/12 p-5 sm:px-6"><Button className="w-full" disabled={!canRun} onClick={run}>{startRun.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}Run {planned} {mode} {planned === 1 ? "test" : "tests"}</Button><p className="mt-2 text-center text-xs text-secondary-text">{overLimit ? `Pick fewer cases or repeats: the limit is ${maxConversations} per run.` : mode === "voice" ? "About 2 minutes per conversation; up to 3 run at once." : "About a minute per conversation; up to 3 run at once."}</p></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CallsView({ agents, agentId, onAgentChange }: { agents: AgentSummary[]; agentId: string; onAgentChange: (id: string) => void }) {
  const agent = agents.find((item) => item.id === agentId) ?? agents[0];
  return <div className="mx-auto flex max-w-6xl flex-col gap-5">
    <PageHeader crumbs={[{ label: "Agent testing", href: "/agent-testing" }, { label: "Calls & recordings" }]} title="Calls & recordings" description="Every test conversation with its transcript, the checks it failed, and the answers the agent collected." actions={<AgentSelect agents={agents} value={agent?.id ?? ""} onChange={onAgentChange} />} />
    {agent && <RunResultsView agentId={agent.id} />}
  </div>;
}

function ManualCallView({ agents, agentId, onAgentChange }: { agents: AgentSummary[]; agentId: string; onAgentChange: (id: string) => void }) {
  const agent = agents.find((item) => item.id === agentId) ?? agents[0];
  const [number, setNumber] = useState("");
  const { data: agentDetails } = useGetAgent(agent?.id);
  const languageOptions = agentDetails?.definition?.languages ?? ["English", "Hindi", "Hinglish", "Telugu"];
  return <div className="mx-auto flex max-w-5xl flex-col gap-5">
    <PageHeader crumbs={[{ label: "Agent testing", href: "/agent-testing" }, { label: "Manual test call" }]} title="Manual test call" description="Have the screening agent call your phone so you can test it yourself. Real dialing isn't connected yet." actions={<AgentSelect agents={agents} value={agent?.id ?? ""} onChange={onAgentChange} />} />
    <SetupConnectionNote />
    <div className="grid items-start gap-5 md:grid-cols-3">
      <Card tone="blue" className="md:col-span-2"><CardHeader><div><Typography as="h2" size="heading4" fontWeight="bold">Call my phone</Typography><Typography size="paragraph3" tone="muted">This will call only the test number you enter.</Typography></div></CardHeader><CardContent className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">Phone number<input type="tel" inputMode="tel" autoComplete="tel" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+91 98765 43210" className="h-11 px-3.5 font-normal placeholder:text-slate-500 rounded-xl border-2 border-ink/25 bg-white text-sm text-ink hover:border-ink/45 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-sun/70 focus-visible:outline-none"/><span className="text-xs font-normal text-secondary-text">The live service will require this number to be on the test allowlist.</span></label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">Start language<select className="h-11 cursor-pointer px-3 font-normal rounded-xl border-2 border-ink/25 bg-white text-sm text-ink hover:border-ink/45 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-sun/70 focus-visible:outline-none">{languageOptions.map((language) => <option key={language}>{language}</option>)}</select></label>
        <div className="note-box border-amber-300 bg-amber-50/90 p-3 text-xs leading-5 text-amber-950">Your agent definition is saved. Real dialing is not available yet because this backend has no call-placement endpoint or provider credentials. The button stays disabled until the call service is configured.</div>
        <Button disabled title="The current backend does not place calls."><PhoneCall aria-hidden="true" />Call me</Button>
      </CardContent></Card>
      <Card tone="yellow"><CardHeader><Typography as="h2" size="heading4" fontWeight="bold">Before calling</Typography></CardHeader><CardContent className="flex flex-col gap-3 text-sm text-ink">{["A QA copy of the agent is connected", "Your phone number is allowlisted", "Call and spend limits are available", "Language voice and transcription are configured"].map((item) => <div key={item} className="flex items-start gap-2"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-[11px] font-black text-amber-800">!</span><span>{item}</span></div>)}<Link href={agent ? agentRoute(agent.id, "describe") : "/agent-testing"} className="mt-2 text-sm font-bold text-ink underline decoration-sun decoration-2 underline-offset-4 hover:decoration-ink">Review agent prompt and languages →</Link></CardContent></Card>
    </div>
  </div>;
}

export default function FocusedTestingPage({ view }: { view: View }) {
  const { data: agents = [], isPending, isError, refetch } = useGetAgents();
  const router = useRouter();
  const pathname = usePathname();
  // The selected agent lives in ?agent= so links and reloads keep it; an unknown id falls back to the first agent.
  const requested = useSearchParams().get("agent");
  const agentId = agents.find((agent) => agent.id === requested)?.id ?? agents[0]?.id ?? "";
  const changeAgent = (id: string) => router.replace(`${pathname}?agent=${encodeURIComponent(id)}`);

  if (isPending) return <div className="mx-auto flex max-w-5xl flex-col gap-4"><Skeleton className="h-10 w-80" /><Skeleton className="h-24 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (isError) return <EmptyState variant="error" icon={<AlertCircle className="size-5" aria-hidden="true" />} title="Couldn't load your agents" description="The Kavach service is unreachable. Check that it is running at the configured URL." action={<Button variant="outlined" onClick={() => void refetch()}>Try again</Button>} />;
  if (!agents.length) return <NoAgentsState />;

  const props = { agents, agentId, onAgentChange: changeAgent };
  if (view === "tests") return <TestRunsView {...props} />;
  if (view === "calls") return <CallsView {...props} />;
  return <ManualCallView {...props} />;
}
