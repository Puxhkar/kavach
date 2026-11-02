import { naradaClient, toApiError } from "./apiClient";

export type ApiResult<T> = { data: T; message: string | null; success: true };

/** Reads throw on failure, so TanStack Query sees the error. */
export async function getApi<T>(url: string): Promise<ApiResult<T>> {
  try {
    const { data } = await naradaClient.get<T>(url);
    return { data, message: null, success: true };
  } catch (error) {
    throw toApiError(error);
  }
}
