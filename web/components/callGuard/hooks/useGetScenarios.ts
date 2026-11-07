import { useQuery } from "@tanstack/react-query";

import { callGuardKeys, getScenarios } from "../callGuard.service";

export function useGetScenarios() {
  return useQuery({ queryKey: callGuardKeys.scenarios(), queryFn: getScenarios });
}
