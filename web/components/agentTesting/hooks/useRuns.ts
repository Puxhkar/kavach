import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  agentTestingKeys,
  getRun,
  getRuns,
  startRun,
} from "../agentTesting.service";
import type {
  Run,
  RunStatus,
  RunSummary,
  StartRunBody,
} from "../agentTesting.types";

const POLL_MS = 2000;

export const isRunActive = (status: RunStatus) =>
  status === "queued" || status === "running";

/** Runs for one agent, newest first. Polls while any of them is still going. */
export function useGetRuns(agentId: string | undefined) {
  return useQuery({
    queryKey: agentTestingKeys.runs(agentId ?? ""),
    queryFn: () => getRuns(agentId ?? ""),
    enabled: !!agentId,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((run: RunSummary) =>
        isRunActive(run.status),
      )
        ? POLL_MS
        : false,
  });
}

/** One run with its conversations. Polls until it finishes, so transcripts fill in live. */
export function useGetRun(runId: string | undefined) {
  return useQuery({
    queryKey: agentTestingKeys.run(runId ?? ""),
    queryFn: () => getRun(runId ?? ""),
    enabled: !!runId,
    refetchInterval: (query) => {
      const run: Run | undefined = query.state.data;
      return run && isRunActive(run.status) ? POLL_MS : false;
    },
  });
}

export function useStartRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: StartRunBody) => startRun(body),
    onSuccess: (run) => {
      queryClient.setQueryData(agentTestingKeys.run(run.id), run);
      void queryClient.invalidateQueries({
        queryKey: agentTestingKeys.runs(run.agentId),
      });
    },
  });
}
