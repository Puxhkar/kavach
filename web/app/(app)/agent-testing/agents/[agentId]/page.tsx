import { Suspense } from "react";

import AgentSetupView from "@/components/agentTesting/components/AgentSetupView";

export default async function AgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  // AgentSetupView reads ?step= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <AgentSetupView agentId={agentId} />
    </Suspense>
  );
}
