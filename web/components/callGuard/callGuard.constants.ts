import type { Category, DrillVerdict, ErrandOutcome, ErrandStatus, Priority, RecipientBehaviour, Turn } from "./callGuard.types";

export const CALL_GUARD_ROUTE = "/call-guard";
export const CALL_GUARD_LIVE_ROUTE = "/call-guard/live";
export const CALL_GUARD_DRILL_ROUTE = "/call-guard/drill";
export const CALL_GUARD_SETTINGS_ROUTE = "/call-guard/settings";
export const CALL_GUARD_ERRANDS_ROUTE = "/call-guard/errands";

export const callRoute = (callId: string) => `${CALL_GUARD_LIVE_ROUTE}?call=${encodeURIComponent(callId)}`;
export const drillRoute = (drillId: string) => `${CALL_GUARD_DRILL_ROUTE}?drill=${encodeURIComponent(drillId)}`;
export const errandRoute = (errandId: string) => `${CALL_GUARD_ERRANDS_ROUTE}?errand=${encodeURIComponent(errandId)}`;

export const PRIORITY: Record<Priority, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "border-orange-300 bg-orange-100 text-orange-900" },
  high: { label: "High", className: "border-blue-300 bg-sky text-blue-900" },
  normal: { label: "Normal", className: "border-slate-300 bg-slate-100 text-slate-800" },
  low: { label: "Low", className: "border-slate-200 bg-white text-slate-600" },
  blocked: { label: "Scam blocked", className: "border-red-300 bg-rose-light text-red-800" },
};

export const CATEGORY: Record<Category, string> = {
  scam: "Scam",
  family: "Family",
  work: "Work",
  bank: "Bank",
  delivery: "Delivery",
  sales: "Sales",
  personal: "Personal",
  other: "Other",
};

export const VERDICT: Record<DrillVerdict, { label: string; className: string }> = {
  safe: { label: "Stayed safe", className: "border-emerald-300 bg-mint text-emerald-900" },
  at_risk: { label: "At risk", className: "border-amber-300 bg-amber-50 text-amber-900" },
  scammed: { label: "Got scammed", className: "border-red-300 bg-rose-light text-red-800" },
};

export const OUTCOME: Record<ErrandOutcome, { label: string; className: string }> = {
  agreed: { label: "Agreed", className: "border-emerald-300 bg-mint text-emerald-900" },
  needs_follow_up: { label: "Needs follow-up", className: "border-amber-300 bg-amber-50 text-amber-900" },
  declined: { label: "Declined", className: "border-red-300 bg-rose-light text-red-800" },
  not_reached: { label: "Not reached", className: "border-slate-300 bg-slate-100 text-slate-800" },
};

export const BEHAVIOURS: { value: RecipientBehaviour; label: string }[] = [
  { value: "agrees", label: "Agrees" },
  { value: "needs_time", label: "Needs more time" },
  { value: "asks_question", label: "Asks a question" },
];

/** The list badge for an errand: its outcome once reported, else where it is. */
export function errandBadge(status: ErrandStatus, outcome: ErrandOutcome | null): { label: string; className: string } {
  if (status === "done" && outcome) return OUTCOME[outcome];
  if (status === "running") return { label: "On call…", className: "border-blue-300 bg-sky text-blue-900" };
  if (status === "triaging") return { label: "Writing report…", className: "border-blue-300 bg-sky text-blue-900" };
  if (status === "error") return { label: "Failed", className: "border-red-300 bg-rose-light text-red-800" };
  if (status === "done") return { label: "Done", className: "border-slate-300 bg-slate-100 text-slate-800" };
  return { label: "Not called yet", className: "border-ink/20 bg-white text-slate-700" };
}

/** An errand on a call or having its report written. */
export const isErrandActive = (status: ErrandStatus) => status === "running" || status === "triaging";

type SpokenTurn = Pick<Turn, "speaker" | "language">;

/**
 * Per line: the language the AI switched to on that line, else null. A switch is an AI line whose
 * language differs from the AI's previous line that had one; the first AI line is never a switch.
 */
export function languageSwitches(lines: SpokenTurn[]): (string | null)[] {
  let current: string | null = null;
  return lines.map((line) => {
    if (line.speaker !== "ai" || !line.language) return null;
    const switched = current !== null && current !== line.language;
    current = line.language;
    return switched ? line.language : null;
  });
}

/** The language the AI spoke most recently, if any line says. */
export function lastAiLanguage(lines: SpokenTurn[]): string | null {
  return lines.findLast((line) => line.speaker === "ai" && !!line.language)?.language ?? null;
}

/** Text and bar colour for a 0–100 scam risk. */
export function riskTone(risk: number): { text: string; bar: string; pill: string } {
  if (risk >= 70) return { text: "text-red-700", bar: "bg-red-500", pill: "border-red-300 bg-rose-light text-red-800" };
  if (risk >= 40) return { text: "text-amber-800", bar: "bg-amber-500", pill: "border-amber-300 bg-amber-50 text-amber-900" };
  return { text: "text-emerald-700", bar: "bg-emerald-500", pill: "border-emerald-300 bg-mint/70 text-emerald-900" };
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

export const formatDuration = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/** Case and punctuation don't count as mishearing. */
export function heardDiffers(text: string, heard: string | null): heard is string {
  if (heard === null) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return norm(text) !== norm(heard);
}
