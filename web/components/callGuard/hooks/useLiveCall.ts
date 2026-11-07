import { useMutation, useQueryClient } from "@tanstack/react-query";

import { callGuardKeys, endLive, sendLiveTurn, startLive } from "../callGuard.service";
import type { StartLiveBody } from "../callGuard.types";

export function useStartLive() {
  return useMutation({ mutationFn: (body: StartLiveBody) => startLive(body) });
}

export function useSendLiveTurn() {
  return useMutation({
    mutationFn: ({ liveId, wav }: { liveId: string; wav: Blob }) => sendLiveTurn(liveId, wav),
  });
}

export function useEndLive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ liveId, hungUp }: { liveId: string; hungUp: boolean }) => endLive(liveId, hungUp),
    onSuccess: (end) => {
      if (end.kind === "errand") {
        void queryClient.invalidateQueries({ queryKey: callGuardKeys.errand(end.id) });
        void queryClient.invalidateQueries({ queryKey: callGuardKeys.errands() });
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: end.kind === "drill" ? callGuardKeys.drills() : callGuardKeys.calls(),
      });
    },
  });
}
