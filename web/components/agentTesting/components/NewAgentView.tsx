"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AGENT_TESTING_ROUTE, agentRoute } from "../agentTesting.constants";
import { useCreateAgent } from "../hooks/useAgentMutations";
import ConnectStepForm from "./ConnectStepForm";
import PageHeader from "./PageHeader";
import SetupStepper from "./SetupStepper";

export default function NewAgentView() {
  const router = useRouter();
  const createAgent = useCreateAgent();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        crumbs={[{ label: "Agent testing", href: AGENT_TESTING_ROUTE }, { label: "New agent" }]}
        title="New agent"
        description="Four short steps: connect the agent, describe what it must do, pick the tests, then run them."
      />
      <SetupStepper current="connect" progress={null} />
      <ConnectStepForm
        submitLabel="Save and continue"
        isSaving={createAgent.isPending}
        onSubmit={(values) => createAgent.mutateAsync(values)}
        onSaved={(agent) => {
          toast.success("Agent added. Now describe what it must do.");
          router.push(agentRoute(agent.id, "describe"));
        }}
      />
    </div>
  );
}
