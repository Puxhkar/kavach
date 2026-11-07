import { NARADA_API_URL } from "@/apis/utils/apiClient";
import { getApi } from "@/apis/utils/getApi";
import { postApi, postFormApi, putApi, unwrap } from "@/apis/utils/writeApi";

import type {
  Call,
  CreateErrandBody,
  Drill,
  Errand,
  LiveEnd,
  LiveStart,
  LiveTurn,
  Profile,
  ProfileBody,
  ScenarioList,
  SimulateErrandBody,
  StartLiveBody,
} from "./callGuard.types";

export const callGuardKeys = {
  all: ["callGuard"] as const,
  profile: () => [...callGuardKeys.all, "profile"] as const,
  scenarios: () => [...callGuardKeys.all, "scenarios"] as const,
  calls: () => [...callGuardKeys.all, "calls"] as const,
  call: (callId: string) => [...callGuardKeys.all, "call", callId] as const,
  drills: () => [...callGuardKeys.all, "drills"] as const,
  drill: (drillId: string) => [...callGuardKeys.all, "drill", drillId] as const,
  errands: () => [...callGuardKeys.all, "errands"] as const,
  errand: (errandId: string) => [...callGuardKeys.all, "errand", errandId] as const,
};

// A spoken turn goes through speech-to-text, the model and text-to-speech; give it longer than reads.
const TURN_TIMEOUT_MS = 60000;

export async function getProfile(): Promise<Profile> {
  const res = await getApi<Profile>("guard/profile");
  return res.data;
}

export async function saveProfile(body: ProfileBody): Promise<Profile> {
  return unwrap(await putApi<Profile>("guard/profile", body));
}

export async function getScenarios(): Promise<ScenarioList> {
  const res = await getApi<ScenarioList>("guard/scenarios");
  return res.data;
}

export async function getCalls(): Promise<Call[]> {
  const res = await getApi<{ calls: Call[] }>("guard/calls");
  return res.data.calls;
}

export async function getCall(callId: string): Promise<Call> {
  const res = await getApi<Call>(`guard/calls/${encodeURIComponent(callId)}`);
  return res.data;
}

export async function simulateCall(scenarioId: string): Promise<Call> {
  return unwrap(await postApi<Call>("guard/calls/simulate", { scenarioId }));
}

export async function getDrills(): Promise<Drill[]> {
  const res = await getApi<{ drills: Drill[] }>("guard/drills");
  return res.data.drills;
}

export async function getDrill(drillId: string): Promise<Drill> {
  const res = await getApi<Drill>(`guard/drills/${encodeURIComponent(drillId)}`);
  return res.data;
}

export async function getErrands(): Promise<Errand[]> {
  const res = await getApi<{ errands: Errand[] }>("guard/errands");
  return res.data.errands;
}

export async function getErrand(errandId: string): Promise<Errand> {
  const res = await getApi<Errand>(`guard/errands/${encodeURIComponent(errandId)}`);
  return res.data;
}

export async function createErrand(body: CreateErrandBody): Promise<Errand> {
  return unwrap(await postApi<Errand>("guard/errands", body));
}

export async function simulateErrand(errandId: string, body: SimulateErrandBody): Promise<Errand> {
  return unwrap(await postApi<Errand>(`guard/errands/${encodeURIComponent(errandId)}/simulate`, body));
}

export async function startLive(body: StartLiveBody): Promise<LiveStart> {
  return unwrap(await postApi<LiveStart>("guard/live", body));
}

export async function sendLiveTurn(liveId: string, wav: Blob): Promise<LiveTurn> {
  const form = new FormData();
  form.append("audio", wav, "turn.wav");
  return unwrap(
    await postFormApi<LiveTurn>(`guard/live/${encodeURIComponent(liveId)}/turn`, form, TURN_TIMEOUT_MS),
  );
}

export async function endLive(liveId: string, hungUp: boolean): Promise<LiveEnd> {
  return unwrap(await postApi<LiveEnd>(`guard/live/${encodeURIComponent(liveId)}/end`, { hungUp }));
}

/** For an <audio> src: the browser fetches it directly (and seeks with range requests). */
export function callRecordingUrl(callId: string): string {
  return `${NARADA_API_URL}/guard/calls/${encodeURIComponent(callId)}/recording`;
}

export function drillRecordingUrl(drillId: string): string {
  return `${NARADA_API_URL}/guard/drills/${encodeURIComponent(drillId)}/recording`;
}

export function errandRecordingUrl(errandId: string): string {
  return `${NARADA_API_URL}/guard/errands/${encodeURIComponent(errandId)}/recording`;
}
