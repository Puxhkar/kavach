import { useQuery } from "@tanstack/react-query";

import { agentTestingKeys, getAgents } from "../agentTesting.service";

export function useGetAgents() {
  return useQuery({ queryKey: agentTestingKeys.agents(), queryFn: getAgents });
}
