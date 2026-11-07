// Mirrors services/narada/app/api/v1/schemas/guard.py. camelCase on the wire.

export type Category = "scam" | "family" | "work" | "bank" | "delivery" | "sales" | "personal" | "other";

export type Priority = "urgent" | "high" | "normal" | "low" | "blocked";

export type CallStatus = "running" | "triaging" | "done" | "error";

export type CallSource = "simulated" | "live";

export type VipContact = { name: string; relation: string };

export type ProfileBody = {
  ownerName: string;
  availability: string;
  /** The opening language: the assistant greets in it before it knows the other person's. One of listenLanguages. */
  language: string;
  vipContacts: VipContact[];
  notes: string;
  /** Languages people may speak to the assistant (1–4); speech recognition detects which one it heard. */
  listenLanguages: string[];
};

/** `languages`: drill language choices (incl. Hinglish). `listenOptions`: choices for listenLanguages. */
export type Profile = ProfileBody & { languages: string[]; listenOptions: string[] };

export type Scenario = {
  id: string;
  title: string;
  description: string;
  expected: Category;
  scam: boolean;
  noisyLine: boolean;
  /** The language this AI caller speaks. */
  language: string;
};

export type ScenarioList = { callers: Scenario[]; scams: Scenario[]; voiceAvailable: boolean };

export type Turn = {
  speaker: "ai" | "person";
  text: string;
  heard: string | null;
  startMs: number | null;
  endMs: number | null;
  /** AI lines: the language it spoke. Person lines: the language speech recognition detected. */
  language: string | null;
};

export type Triage = {
  callerName: string;
  organisation: string;
  purpose: string;
  category: Category;
  priority: Priority;
  scamRisk: number;
  redFlags: string[];
  callback: string;
  summary: string;
  action: string;
  vip: boolean;
};

export type Call = {
  id: string;
  source: CallSource;
  status: CallStatus;
  createdAt: string;
  language: string;
  scenarioId: string | null;
  scenarioTitle: string;
  transcript: Turn[];
  triage: Triage | null;
  durationMs: number;
  hasRecording: boolean;
  error: string;
};

export type DrillVerdict = "safe" | "at_risk" | "scammed";

export type DrillCheck = { name: string; passed: boolean; detail: string; critical: boolean };

export type DrillResult = {
  score: number;
  verdict: DrillVerdict;
  checks: DrillCheck[];
  tips: string[];
  familyMessage: string;
};

export type Drill = {
  id: string;
  scamId: string;
  scamTitle: string;
  practicerName: string;
  language: string;
  status: CallStatus;
  createdAt: string;
  transcript: Turn[];
  result: DrillResult | null;
  durationMs: number;
  hasRecording: boolean;
  hungUp: boolean;
  error: string;
};

export type ErrandStatus = "pending" | CallStatus;

export type ErrandOutcome = "agreed" | "needs_follow_up" | "declined" | "not_reached";

export type RecipientBehaviour = "agrees" | "needs_time" | "asks_question";

export type ErrandReport = {
  outcome: ErrandOutcome;
  commitment: string;
  concerns: string[];
  summary: string;
  nextStep: string;
};

/** "Call for me": the assistant phones someone on the owner's behalf. */
export type Errand = {
  id: string;
  recipientName: string;
  recipientRole: string;
  task: string;
  deadline: string;
  status: ErrandStatus;
  createdAt: string;
  source: CallSource | null;
  /** The language the call settled on. */
  language: string | null;
  transcript: Turn[];
  report: ErrandReport | null;
  durationMs: number;
  hasRecording: boolean;
  error: string;
};

export type CreateErrandBody = { recipientName: string; recipientRole?: string; task: string; deadline?: string };

export type SimulateErrandBody = { language: string; behaviour: RecipientBehaviour };

export type LiveKind = "screener" | "drill" | "errand";

export type StartLiveBody = {
  kind: LiveKind;
  scamId?: string;
  /** Required for kind "errand". */
  errandId?: string;
  language?: string;
  practicerName?: string;
};

/** `language`: the language the AI spoke this line in. */
export type SpokenLine = { text: string; audioBase64: string; language: string };

export type LiveStart = { liveId: string; kind: LiveKind; reply: SpokenLine; ended: boolean };

/** `heardLanguage`: the language speech recognition detected in what the person said. */
export type LiveTurn = { heard: string; heardLanguage: string | null; reply: SpokenLine | null; ended: boolean };

/** `id` is the call, drill or errand id, by `kind`. */
export type LiveEnd = { kind: LiveKind; id: string };
