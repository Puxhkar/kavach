import { useQuery } from "@tanstack/react-query";

import { agentTestingKeys, getSituations } from "../agentTesting.service";

export function useGetSituations(agentId: string | undefined) {
  return useQuery({
    queryKey: agentTestingKeys.situations(agentId ?? ""),
    queryFn: () => getSituations(agentId ?? ""),
    enabled: !!agentId,
  });
}
