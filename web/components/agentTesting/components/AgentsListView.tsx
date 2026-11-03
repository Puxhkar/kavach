"use client";

import { AlertTriangle, Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@ui/components/ui/badge";
import { buttonVariants } from "@ui/components/ui/button";
import { Card } from "@ui/components/ui/card";
import { EmptyState } from "@ui/components/ui/empty-state";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Typography } from "@ui/components/ui/typography";

import { AGENT_TESTING_ROUTE, VENDOR_COPY, agentRoute } from "../agentTesting.constants";
import type { AgentSummary } from "../agentTesting.types";
import { useGetAgents } from "../hooks/useGetAgents";
import PageHeader from "./PageHeader";
import QuickTestCard from "./QuickTestCard";

const NEW_AGENT_HREF = `${AGENT_TESTING_ROUTE}/agents/new`;

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

function SetupStatus({ agent }: { agent: AgentSummary }) {
  if (agent.setup.nextStep === "ready") return <Badge variant="success" className="self-start sm:self-auto">Ready to test</Badge>;
  if (agent.setup.nextStep === "describe") return <Badge variant="warning" className="self-start sm:self-auto">Needs description</Badge>;
  return <Badge variant="warning" className="self-start sm:self-auto">Needs connection</Badge>;
}

function AgentRow({ agent }: { agent: AgentSummary }) {
  const href = agentRoute(agent.id);
  return (
    <li>
      <Link
        href={href}
        className="sketch-tile flex flex-col gap-2 px-4 py-3.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink sm:flex-row sm:items-center sm:gap-6"
      >
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-1">
          <Typography fontWeight="bold" className="truncate">
            {agent.name}
          </Typography>
          <Typography size="paragraph3" tone="muted" className="truncate">
            {VENDOR_COPY[agent.vendor].name}{agent.assistantId ? ` · ${agent.assistantId}` : ""}
          </Typography>
        </div>
        <Typography size="paragraph3" tone="muted" className="tabular-nums sm:w-[22rem] sm:shrink-0 sm:text-right">
          {agent.promptVersion ? `Prompt v${agent.promptVersion}` : "No prompt yet"} ·{" "}
          {agent.answersCount} {agent.answersCount === 1 ? "answer" : "answers"} · updated{" "}
          {dateFormat.format(new Date(agent.updatedAt))}
        </Typography>
        <SetupStatus agent={agent} />
      </Link>
    </li>
  );
}

export default function AgentsListView() {
  const { data: agents, isPending, isError, error, refetch } = useGetAgents();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-7">
      <PageHeader
        crumbs={[{ label: "Agent Lab" }]}
        title="Test a voice agent"
        description="Find where your voice agent breaks before real callers do."
        actions={
          <Link href={NEW_AGENT_HREF} className={buttonVariants({ variant: "quiet" })}>
            <Plus aria-hidden="true" />
            Set up step by step
          </Link>
        }
      />

      <QuickTestCard />

      {isPending ? (
        <Card aria-busy="true" aria-label="Loading agents" className="p-4 sm:p-5">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-6 px-1 py-3">
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          ))}
        </Card>
      ) : isError ? (
        <EmptyState
          variant="error"
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          title="Couldn't load agents"
          description={error.message}
          action={
            <button type="button" onClick={() => void refetch()} className={buttonVariants({ variant: "outlined" })}>
              Try again
            </button>
          }
        />
      ) : agents.length > 0 ? (
        <section aria-label="Your agents" className="flex flex-col gap-3">
          <Typography as="h2" size="heading4" fontWeight="bold">Your agents</Typography>
          <ul className="flex flex-col gap-2.5">
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
