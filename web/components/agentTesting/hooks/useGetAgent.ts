import { useQuery } from "@tanstack/react-query";

import { agentTestingKeys, getAgent } from "../agentTesting.service";

export function useGetAgent(agentId: string | undefined) {
  return useQuery({
    queryKey: agentTestingKeys.agent(agentId ?? ""),
    queryFn: () => getAgent(agentId ?? ""),
    enabled: !!agentId,
  });
}
