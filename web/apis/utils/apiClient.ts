import axios, { AxiosError } from "axios";

export type FieldError = { field: string; message: string };

/** Thrown by `getApi` and by mutation hooks when a write returns `success: false`. */
export class ApiError extends Error {
  status: number | null;
  code: string | null;
  fieldErrors: FieldError[];

  constructor(
    message: string,
    status: number | null,
    code: string | null,
    fieldErrors: FieldError[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

type ErrorBody = { detail?: unknown; errors?: unknown };

function isFieldErrorList(value: unknown): value is FieldError[] {
  return (
    Array.isArray(value) &&
    value.every(
      (e) =>
        typeof e === "object" && e !== null && "field" in e && "message" in e,
    )
  );
}

type PydanticIssue = { loc: (string | number)[]; msg: string };

function isPydanticIssueList(value: unknown): value is PydanticIssue[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (e) => typeof e === "object" && e !== null && Array.isArray(e.loc) && typeof e.msg === "string",
    )
  );
}

// FastAPI's own 422 (a request that fails the schema before reaching a handler) lists
// issues under `detail`; map them to the same field paths the domain errors use.
const fromPydantic = (issues: PydanticIssue[]): FieldError[] =>
  issues.map((issue) => ({
    field: issue.loc.filter((part, i) => !(i === 0 && part === "body")).join("."),
    message: issue.msg,
  }));

const FRIENDLY: Record<string, string> = {
  agent_not_found: "This agent no longer exists.",
  run_not_found: "This test run no longer exists.",
  llm_not_configured:
    "Test runs need a language model. Start Ollama (ollama serve) or set LLM_BASE_URL in services/narada/.env, then restart.",
  speech_not_configured:
    "Voice tests need GNANI_API_KEY in services/narada/.env. Add it and restart the service.",
  recording_not_found: "This conversation has no recording.",
  validation_failed: "Some fields need fixing.",
  live_not_found: "This call has already ended.",
  call_not_found: "This call no longer exists.",
  drill_not_found: "This drill no longer exists.",
  errand_not_found: "This errand no longer exists.",
  scenario_not_found: "That caller is no longer available. Reload the page.",
  audio_invalid: "Couldn't read the recording. Try again.",
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    if (!error.response && error.code === "ECONNABORTED") {
      return new ApiError("The service took too long to answer. Try again.", null, "timeout", []);
    }
    if (!error.response) {
      return new ApiError(
        "Can't reach the Kavach service. Check that it is running.",
        null,
        "network_error",
        [],
      );
    }
    const body = (error.response.data ?? {}) as ErrorBody;
    const pydantic = isPydanticIssueList(body.detail) ? fromPydantic(body.detail) : null;
    const code = typeof body.detail === "string" ? body.detail : pydantic ? "validation_failed" : null;
    const fieldErrors = isFieldErrorList(body.errors) ? body.errors : (pydantic ?? []);
    const message =
      (code && FRIENDLY[code]) ||
      code ||
      `Request failed (${error.response.status})`;
    return new ApiError(message, error.response.status, code, fieldErrors);
  }
  return new ApiError("Something went wrong.", null, null, []);
}

/** Hosts like Render hand over a bare host name ("api.onrender.com"); calls need a scheme. */
export function withScheme(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

export const NARADA_API_URL = `${withScheme(process.env.NEXT_PUBLIC_NARADA_URL || "http://localhost:8010")}/api/v1`;

export const naradaClient = axios.create({
  baseURL: NARADA_API_URL,
  timeout: 20000,
});
