import { ApiError, naradaClient, toApiError } from "./apiClient";

export type WriteResult<T> =
  | { data: T; message: string | null; success: true }
  | { data: null; message: string; success: false; error: ApiError };

type Method = "post" | "put" | "patch" | "delete";

/** Writes return `{ success: false }` instead of throwing, so a form can show field errors inline. */
async function send<T>(method: Method, url: string, body?: unknown): Promise<WriteResult<T>> {
  try {
    const { data } = await naradaClient.request<T>({ method, url, data: body });
    return { data, message: null, success: true };
  } catch (err) {
    const error = toApiError(err);
    return { data: null, message: error.message, success: false, error };
  }
}

export const postApi = <T>(url: string, body: unknown) => send<T>("post", url, body);
export const putApi = <T>(url: string, body: unknown) => send<T>("put", url, body);
export const patchApi = <T>(url: string, body: unknown) => send<T>("patch", url, body);
export const deleteApi = <T>(url: string) => send<T>("delete", url);

/** Multipart upload (axios sets the boundary header from the FormData). */
export async function postFormApi<T>(
  url: string,
  form: FormData,
  timeoutMs?: number,
): Promise<WriteResult<T>> {
  try {
    const { data } = await naradaClient.post<T>(url, form, timeoutMs ? { timeout: timeoutMs } : undefined);
    return { data, message: null, success: true };
  } catch (err) {
    const error = toApiError(err);
    return { data: null, message: error.message, success: false, error };
  }
}

/** For mutation hooks: turn a failed write into a thrown ApiError so `onError` fires. */
export function unwrap<T>(result: WriteResult<T>): T {
  if (!result.success) throw result.error;
  return result.data;
}
