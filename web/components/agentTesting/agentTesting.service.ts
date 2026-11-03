import { NARADA_API_URL } from "@/apis/utils/apiClient";
import { getApi } from "@/apis/utils/getApi";
import { postApi, putApi, unwrap } from "@/apis/utils/writeApi";

import type {
  Agent,
  AgentDefinition,
  AgentOptions,
  AgentSummary,
  ConnectAgentBody,
  QuickAgentBody,
  Run,
  RunSummary,
  SituationList,
  StartRunBody,
} from "./agentTesting.types";

export const agentTestingKeys = {
  all: ["agentTesting"] as const,
  agents: () => [...agentTestingKeys.all, "agents"] as const,
  agent: (agentId: string) =>
    [...agentTestingKeys.all, "agent", agentId] as const,
  options: () => [...agentTestingKeys.all, "options"] as const,
  situations: (agentId: string) =>
    [...agentTestingKeys.all, "situations", agentId] as const,
  runs: (agentId: string) =>
    [...agentTestingKeys.all, "runs", agentId] as const,
  run: (runId: string) => [...agentTestingKeys.all, "run", runId] as const,
};

export async function getAgents(): Promise<AgentSummary[]> {
  const res = await getApi<{ agents: AgentSummary[] }>("agents");
  return res.data.agents;
}

export async function getAgent(agentId: string): Promise<Agent> {
  const res = await getApi<Agent>(`agents/${encodeURIComponent(agentId)}`);
  return res.data;
}

export async function getAgentOptions(): Promise<AgentOptions> {
  const res = await getApi<AgentOptions>("agents/options");
  return res.data;
}

export async function createAgent(body: ConnectAgentBody): Promise<Agent> {
  return unwrap(await postApi<Agent>("agents", body));
}

/** Paste a prompt; the service drafts the rest and returns an agent ready to test. */
export async function quickCreateAgent(body: QuickAgentBody): Promise<Agent> {
  return unwrap(await postApi<Agent>("agents/quick", body));
}

export async function updateAgentConnection(
  agentId: string,
  body: ConnectAgentBody,
): Promise<Agent> {
  return unwrap(
    await putApi<Agent>(
      `agents/${encodeURIComponent(agentId)}/connection`,
      body,
    ),
  );
}

export async function saveAgentDefinition(
  agentId: string,
  body: AgentDefinition,
): Promise<Agent> {
  return unwrap(
    await putApi<Agent>(
      `agents/${encodeURIComponent(agentId)}/definition`,
      body,
    ),
  );
}

export async function getSituations(agentId: string): Promise<SituationList> {
  const res = await getApi<SituationList>(
    `agents/${encodeURIComponent(agentId)}/situations`,
  );
  return res.data;
}

export async function getRuns(agentId: string): Promise<RunSummary[]> {
  const res = await getApi<{ runs: RunSummary[] }>(
    `runs?agentId=${encodeURIComponent(agentId)}`,
  );
  return res.data.runs;
}

export async function getRun(runId: string): Promise<Run> {
  const res = await getApi<Run>(`runs/${encodeURIComponent(runId)}`);
  return res.data;
}

export async function startRun(body: StartRunBody): Promise<Run> {
  return unwrap(await postApi<Run>("runs", body));
}

/** For an <audio> src: the browser fetches it directly (and seeks with range requests). */
export function recordingUrl(runId: string, conversationId: string): string {
  return `${NARADA_API_URL}/runs/${encodeURIComponent(runId)}/conversations/${encodeURIComponent(conversationId)}/recording`;
}
