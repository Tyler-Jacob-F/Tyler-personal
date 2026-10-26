import { apiErrorSchema } from '@the-keep/shared';
import type { z } from 'zod';
import { config } from '@/config';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: Array<{ path: string; message: string }>;

  constructor(
    status: number,
    code: string,
    message: string,
    issues: ApiRequestError['issues'] = [],
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export interface ApiRequest<T> {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** Response schema from @the-keep/shared; the client never trusts a body it has not parsed. */
  schema: z.ZodType<T>;
  query?: Record<string, string | number | undefined>;
}

export type TokenSource = () => Promise<string | null>;

/**
 * The thin typed fetch the brief asks for. One function; resources build on it in
 * src/api/<resource>.ts with a `<resource>Keys` factory each.
 */
export function createApiClient(getToken: TokenSource, base = config.apiBase) {
  return async function apiFetch<T>(
    path: string,
    { method = 'GET', body, schema, query }: ApiRequest<T>,
  ): Promise<T> {
    const url = new URL(base + path, window.location.origin);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const token = await getToken();
    const response = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (response.status === 204) return schema.parse(undefined);
    const text = await response.text();
    let data: unknown = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      throw new ApiRequestError(
        response.status,
        'bad_response',
        `Unreadable response (${response.status})`,
      );
    }
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(data);
      if (parsed.success) {
        throw new ApiRequestError(
          response.status,
          parsed.data.error,
          parsed.data.message,
          parsed.data.issues,
        );
      }
      throw new ApiRequestError(
        response.status,
        'http_error',
        `Request failed (${response.status})`,
      );
    }
    return schema.parse(data);
  };
}

export type ApiFetch = ReturnType<typeof createApiClient>;
