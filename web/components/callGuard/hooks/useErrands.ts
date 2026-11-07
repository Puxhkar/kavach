import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isErrandActive } from "../callGuard.constants";
import { callGuardKeys, createErrand, getErrand, getErrands, simulateErrand } from "../callGuard.service";
import type { CreateErrandBody, Errand, SimulateErrandBody } from "../callGuard.types";

const POLL_MS = 2000;

/** Newest first. Polls only while an errand call is still going or being written up. */
export function useGetErrands() {
  return useQuery({
    queryKey: callGuardKeys.errands(),
    queryFn: getErrands,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((errand: Errand) => isErrandActive(errand.status)) ? POLL_MS : false,
  });
}

/** One errand. Polls while it is on a call or its report is being written, so the transcript fills in live. */
export function useGetErrand(errandId: string | undefined) {
  return useQuery({
    queryKey: callGuardKeys.errand(errandId ?? ""),
    queryFn: () => getErrand(errandId ?? ""),
    enabled: !!errandId,
    refetchInterval: (query) => {
      const errand: Errand | undefined = query.state.data;
      return errand && isErrandActive(errand.status) ? POLL_MS : false;
    },
  });
}

export function useCreateErrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateErrandBody) => createErrand(body),
    onSuccess: (errand) => {
      queryClient.setQueryData(callGuardKeys.errand(errand.id), errand);
      void queryClient.invalidateQueries({ queryKey: callGuardKeys.errands() });
    },
  });
}

export function useSimulateErrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ errandId, body }: { errandId: string; body: SimulateErrandBody }) => simulateErrand(errandId, body),
    onSuccess: (errand) => {
      queryClient.setQueryData(callGuardKeys.errand(errand.id), errand);
      void queryClient.invalidateQueries({ queryKey: callGuardKeys.errands() });
    },
  });
}
