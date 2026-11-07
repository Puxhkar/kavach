import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { callGuardKeys, getCall, getCalls, simulateCall } from "../callGuard.service";
import type { Call, CallStatus } from "../callGuard.types";

const POLL_MS = 2000;

export const isCallActive = (status: CallStatus) => status === "running" || status === "triaging";

/** The inbox, already priority-sorted by the API. Polls only while a call is still going. */
export function useGetCalls() {
  return useQuery({
    queryKey: callGuardKeys.calls(),
    queryFn: getCalls,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((call: Call) => isCallActive(call.status)) ? POLL_MS : false,
  });
}

/** One call with its transcript. Polls until it is triaged, so the transcript fills in live. */
export function useGetCall(callId: string | undefined) {
  return useQuery({
    queryKey: callGuardKeys.call(callId ?? ""),
    queryFn: () => getCall(callId ?? ""),
    enabled: !!callId,
    refetchInterval: (query) => {
      const call: Call | undefined = query.state.data;
      return call && isCallActive(call.status) ? POLL_MS : false;
    },
  });
}

export function useSimulateCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scenarioId: string) => simulateCall(scenarioId),
    onSuccess: (call) => {
      queryClient.setQueryData(callGuardKeys.call(call.id), call);
      void queryClient.invalidateQueries({ queryKey: callGuardKeys.calls() });
    },
  });
}
