import { ApiError } from "@/apis/utils/apiClient";

/** A toast-ready message: the server's first field message (e.g. "That errand is already on a call") beats the generic one. */
export function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.fieldErrors[0]?.message) return error.fieldErrors[0].message;
  return error instanceof Error ? error.message : fallback;
}
