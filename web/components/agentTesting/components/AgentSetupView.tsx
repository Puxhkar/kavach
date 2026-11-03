"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@ui/components/ui/badge";
import { buttonVariants } from "@ui/components/ui/button";
import { EmptyState } from "@ui/components/ui/empty-state";
import { Skeleton } from "@ui/components/ui/skeleton";

import { AGENT_TESTING_ROUTE, VENDOR_COPY, agentRoute } from "../agentTesting.constants";
import type { Agent, SetupPageStep } from "../agentTesting.types";
import { useUpdateAgentConnection } from "../hooks/useAgentMutations";
import { useGetAgent } from "../hooks/useGetAgent";
import ConnectStepForm from "./ConnectStepForm";
import DescribeStepForm from "./DescribeStepForm";
import PageHeader from "./PageHeader";
import SetupStepper from "./SetupStepper";

const STEPS: SetupPageStep[] = ["connect", "describe"];

/** URL wins; otherwise land on the first unfinished step. */
export function resolveStep(requested: string | null, agent: Agent): SetupPageStep {
  const fallback: SetupPageStep = agent.setup.nextStep === "ready" ? "describe" : agent.setup.nextStep;
  if (!requested || !STEPS.includes(requested as SetupPageStep)) return fallback;
  const step = requested as SetupPageStep;
  // Can't describe or test an agent that isn't connected, or test one that isn't described.
  if (step !== "connect" && !agent.setup.connectDone) return "connect";
  return step;
}

function ConnectStep({ agent }: { agent: Agent }) {
  const router = useRouter();
  const updateConnection = useUpdateAgentConnection(agent.id);
  return (
    <ConnectStepForm
      agent={agent}
      submitLabel="Save changes"
      isSaving={updateConnection.isPending}
      onSubmit={(values) => updateConnection.mutateAsync(values)}
      onSaved={(saved) => {
        toast.success("Connection updated.");
        router.push(saved.setup.describeDone ? `/agent-testing/tests?agent=${encodeURIComponent(saved.id)}` : agentRoute(saved.id, "describe"));
      }}
    />
  );
}

export default function AgentSetupView({ agentId }: { agentId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: agent, isPending, isError, error, refetch } = useGetAgent(agentId);

  if (isPending) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6" aria-busy="true" aria-label="Loading agent">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          variant="error"
          icon={<AlertTriangle className="size-5" aria-hidden="true" />}
          title={error.message === "This agent no longer exists." ? "Agent not found" : "Couldn't load this agent"}
          description={error.message}
          action={
            <div className="flex gap-2">
              <button type="button" onClick={() => void refetch()} className={buttonVariants({ variant: "outlined" })}>
                Try again
              </button>
              <Link href={AGENT_TESTING_ROUTE} className={buttonVariants({ variant: "text" })}>
                Back to agents
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const step = resolveStep(searchParams.get("step"), agent);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        crumbs={[{ label: "Agent testing", href: AGENT_TESTING_ROUTE }, { label: agent.name }]}
        title={agent.name}
        meta={
          <Badge variant={agent.setup.nextStep === "ready" ? "success" : "warning"}>
            {agent.setup.nextStep === "ready" ? "Ready to test" : "Setup in progress"}
          </Badge>
        }
        description={agent.assistantId ? `${VENDOR_COPY[agent.vendor].name} · ${agent.assistantId}` : VENDOR_COPY[agent.vendor].name}
      />
      <SetupStepper current={step} progress={agent.setup} agentId={agent.id} />
      {step === "connect" && <ConnectStep agent={agent} />}
      {step === "describe" && (
        <DescribeStepForm
          key={agent.promptVersions.at(-1)?.fingerprint ?? "new"}
          agent={agent}
          onSaved={(saved) => router.push(`/agent-testing/tests?agent=${encodeURIComponent(saved.id)}`)}
        />
      )}
    </div>
  );
}
