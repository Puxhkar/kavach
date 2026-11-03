// Mirrors services/narada/app/api/v1/schemas/agents.py. camelCase on the wire.

/** "none": not connected to a phone platform; tests run against the pasted prompt. */
export type Vendor = "plivo" | "vapi" | "none";

export type AnswerFormat =
  | "text"
  | "number"
  | "amount_lpa"
  | "duration_days"
  | "date"
  | "yes_no"
  | "choice";

export type RuleKind = "must" | "must_not";

export type LanguageSwitch = "follow" | "ask" | "stay";

export type SetupStep = "connect" | "describe" | "ready";

export type CallInput = {
  key: string;
  label: string;
  example: string;
  required: boolean;
};

export type AnswerField = {
  key: string;
  question: string;
  format: AnswerFormat;
  required: boolean;
  choices: string[];
  hint: string;
};

export type AgentRule = { text: string; kind: RuleKind };

export type AgentDefinition = {
  prompt: string;
  callInputs: CallInput[];
  answers: AnswerField[];
  rules: AgentRule[];
  languages: string[];
  languageSwitch: LanguageSwitch;
  callEnding: string;
};

export type SetupProgress = {
  connectDone: boolean;
  describeDone: boolean;
  nextStep: SetupStep;
};

export type AgentSummary = {
  id: string;
  name: string;
  vendor: Vendor;
  assistantId: string;
  promptVersion: number | null;
  answersCount: number;
  setup: SetupProgress;
  updatedAt: string;
};

export type PromptVersion = {
  version: number;
  fingerprint: string;
  createdAt: string;
};

export type Agent = AgentSummary & {
  definition: AgentDefinition | null;
  promptVersions: PromptVersion[];
  createdAt: string;
};

export type AgentOptions = {
  vendors: Vendor[];
  answerFormats: AnswerFormat[];
  languages: string[];
  languageSwitch: LanguageSwitch[];
};

export type ConnectAgentBody = {
  name: string;
  vendor: Vendor;
  assistantId: string;
};

/** Steps in the agent prompt setup flow. */
export type SetupPageStep = "connect" | "describe";

// ── Test runs. Mirrors services/narada/app/api/v1/schemas/runs.py. ──

export type Situation = {
  id: string;
  title: string;
  description: string;
  category: string;
  language: string | null;
  /** Needs audio (e.g. the noisy phone line), so chat runs can't play it. */
  voiceOnly: boolean;
};

export type SituationList = {
  situations: Situation[];
  maxConversationsPerRun: number;
  maxRepeats: number;
  /** Voice runs need the Gnani key on the service. */
  voiceAvailable: boolean;
};

/** chat: text only. voice: both sides spoken with Gnani, the agent hears the candidate
 * through speech recognition, and each conversation keeps a recording. */
export type RunMode = "chat" | "voice";

export type RunStatus = "queued" | "running" | "completed" | "interrupted";

export type ConversationStatus =
  | "queued"
  | "running"
  | "passed"
  | "failed"
  | "error";

export type EndReason = "agent_ended" | "candidate_hung_up" | "turn_limit";

export type AnswerStatus = "correct" | "wrong" | "not_collected" | "declined";

export type CheckKind = "rule" | "answer" | "situation" | "ending" | "language";

export type Turn = {
  speaker: "agent" | "candidate";
  text: string;
  silent: boolean;
  /** Voice runs, candidate turns: what speech recognition heard — all the agent got. */
  heard: string | null;
  /** Voice runs: where the turn sits in the recording. */
  startMs: number | null;
  endMs: number | null;
};

export type Recording = {
  agentVoice: string;
  candidateVoice: string;
  durationMs: number;
};

export type Scenario = {
  candidateName: string;
  persona: string;
  startLanguage: string;
  callInputs: Record<string, string>;
  answers: { key: string; spoken: string; truth: string }[];
  behavior: string;
  expectedOutcome: string;
  gender: string;
};

export type AnswerResult = {
  key: string;
  expected: string;
  agentValue: string;
  status: AnswerStatus;
  acceptable: boolean;
  note: string;
};

export type Check = {
  name: string;
  kind: CheckKind;
  passed: boolean;
  detail: string;
};

export type Conversation = {
  id: string;
  situationId: string;
  situationTitle: string;
  category: string;
  language: string | null;
  repeat: number;
  status: ConversationStatus;
  scenario: Scenario | null;
  transcript: Turn[];
  endReason: EndReason | null;
  answers: AnswerResult[];
  checks: Check[];
  summary: string;
  error: string;
  recording: Recording | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export type RunCounts = {
  total: number;
  passed: number;
  failed: number;
  errored: number;
  pending: number;
};

export type RunSummary = {
  id: string;
  agentId: string;
  agentName: string;
  promptVersion: number;
  mode: RunMode;
  status: RunStatus;
  counts: RunCounts;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type Run = RunSummary & { conversations: Conversation[] };

/** The one-step shortcut: a prompt is enough. */
export type QuickAgentBody = {
  name: string;
  prompt: string;
  languages: string[];
};

export type StartRunBody = {
  agentId: string;
  situationIds: string[];
  repeats: number;
  mode: RunMode;
};
