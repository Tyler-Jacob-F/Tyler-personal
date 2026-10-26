import type { Context } from 'aws-lambda';
import type { ApiEvent, ApiResult } from '../../src/lib/http.js';

export interface FakeRequest {
  method: 'GET' | 'POST' | 'DELETE';
  /** The HTTP API route template, e.g. `/api/documents/{id}`. */
  route: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  /** Email claim on the verified JWT; omit to simulate a request with no claims. */
  email?: string | null;
  rawBody?: string;
}

/** An API Gateway HTTP API (payload 2.0) event as the JWT authorizer would deliver it. */
export function fakeEvent({
  method,
  route,
  params = {},
  query = {},
  body,
  email = 'tyler.fuqua@icloud.com',
  rawBody,
}: FakeRequest): ApiEvent {
  const path = route.replace(/\{(\w+)\}/g, (_m, name: string) => params[name] ?? '');
  const routeKey = `${method} ${route}`;
  return {
    version: '2.0',
    routeKey,
    rawPath: path,
    rawQueryString: new URLSearchParams(query).toString(),
    headers: { 'content-type': 'application/json' },
    queryStringParameters: Object.keys(query).length ? query : undefined,
    pathParameters: Object.keys(params).length ? params : undefined,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    isBase64Encoded: false,
    requestContext: {
      accountId: '697941679713',
      apiId: 'api',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      http: { method, path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'vitest' },
      requestId: 'req-1',
      routeKey,
      stage: '$default',
      time: '26/Oct/2026:12:00:00 +0000',
      timeEpoch: 1793016000000,
      authorizer: {
        jwt: {
          claims: email ? { email, sub: 'sub-1', aud: 'client' } : {},
          scopes: null,
        },
      },
    },
  };
}

export const fakeContext = { awsRequestId: 'aws-req-1' } as Context;

export function bodyOf<T = unknown>(result: ApiResult): T {
  return JSON.parse(result.body ?? 'null') as T;
}
