import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  agentTestingKeys,
  createAgent,
  saveAgentDefinition,
  updateAgentConnection,
} from "../agentTesting.service";
import type { Agent, AgentDefinition, ConnectAgentBody } from "../agentTesting.types";

function useStoreAgent() {
  const queryClient = useQueryClient();
  return (agent: Agent) => {
    queryClient.setQueryData(agentTestingKeys.agent(agent.id), agent);
    void queryClient.invalidateQueries({ queryKey: agentTestingKeys.agents() });
  };
}

export function useCreateAgent() {
  const store = useStoreAgent();
  return useMutation({
    mutationFn: (body: ConnectAgentBody) => createAgent(body),
    onSuccess: store,
  });
}

export function useUpdateAgentConnection(agentId: string) {
  const store = useStoreAgent();
  return useMutation({
    mutationFn: (body: ConnectAgentBody) => updateAgentConnection(agentId, body),
    onSuccess: store,
  });
}

export function useSaveAgentDefinition(agentId: string) {
  const store = useStoreAgent();
  return useMutation({
    mutationFn: (body: AgentDefinition) => saveAgentDefinition(agentId, body),
    onSuccess: store,
  });
}
