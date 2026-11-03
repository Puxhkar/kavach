import { useQuery } from "@tanstack/react-query";

import { agentTestingKeys, getAgentOptions } from "../agentTesting.service";

export function useGetAgentOptions() {
  return useQuery({
    queryKey: agentTestingKeys.options(),
    queryFn: getAgentOptions,
    staleTime: Infinity,
  });
}
