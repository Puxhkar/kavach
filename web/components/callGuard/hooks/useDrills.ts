import { useQuery } from "@tanstack/react-query";

import { callGuardKeys, getDrill, getDrills } from "../callGuard.service";
import type { Drill } from "../callGuard.types";
import { isCallActive } from "./useCalls";

const POLL_MS = 2000;

export function useGetDrills() {
  return useQuery({
    queryKey: callGuardKeys.drills(),
    queryFn: getDrills,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((drill: Drill) => isCallActive(drill.status)) ? POLL_MS : false,
  });
}

/** One drill. Polls while it is being scored. */
export function useGetDrill(drillId: string | undefined) {
  return useQuery({
    queryKey: callGuardKeys.drill(drillId ?? ""),
    queryFn: () => getDrill(drillId ?? ""),
    enabled: !!drillId,
    refetchInterval: (query) => {
      const drill: Drill | undefined = query.state.data;
      return drill && isCallActive(drill.status) ? POLL_MS : false;
    },
  });
}
