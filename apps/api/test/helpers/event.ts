import type { APIGatewayRequestAuthorizerEventV2, Context } from 'aws-lambda';
import type { AgentEvent, ApiEvent, ApiResult, MemberEvent } from '../../src/lib/http.js';

/** The authorizer context a token leaves on a request through the agents' door. */
export interface FakeAgent {
  id: string;
  name: string;
  scopes: string[];
}

export interface FakeRequest {
  method: 'GET' | 'POST' | 'DELETE';
  /** The HTTP API route template, e.g. `/api/documents/{id}`. */
  route: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  /** Email claim on the verified JWT; omit to simulate a request with no claims. */
  email?: string | null;
  /** Set for a request through `/api/agent/*`: what the Lambda authorizer attached. */
  agent?: FakeAgent | null;
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
  agent,
  rawBody,
}: FakeRequest): ApiEvent {
  const path = route.replace(/\{(\w+)\}/g, (_m, name: string) => params[name] ?? '');
  const routeKey = `${method} ${route}`;
  const base = {
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
    },
  };
  if (agent !== undefined) {
    const authorizer = agent
      ? { lambda: { id: agent.id, name: agent.name, scopes: JSON.stringify(agent.scopes) } }
      : { lambda: {} };
    return {
      ...base,
      requestContext: { ...base.requestContext, authorizer },
    } as AgentEvent;
  }
  return {
    ...base,
    requestContext: {
      ...base.requestContext,
      authorizer: {
        jwt: { claims: email ? { email, sub: 'sub-1', aud: 'client' } : {}, scopes: null },
      },
    },
  } as MemberEvent;
}

/** What API Gateway sends the Lambda authorizer for a request to the agents' door. */
export function fakeAuthorizerEvent(
  authorization: string | undefined,
  route = 'GET /api/agent/documents',
): APIGatewayRequestAuthorizerEventV2 {
  const [method = 'GET', path = '/'] = route.split(' ');
  return {
    version: '2.0',
    type: 'REQUEST',
    routeArn: `arn:aws:execute-api:us-east-1:697941679713:api/$default/${method}${path}`,
    identitySource: authorization ? [authorization] : [],
    routeKey: route,
    rawPath: path,
    rawQueryString: '',
    cookies: [],
    headers: {
      ...(authorization ? { authorization } : {}),
      'user-agent': 'vitest',
    },
    queryStringParameters: {},
    requestContext: {
      accountId: '697941679713',
      apiId: 'api',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      http: { method, path, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'vitest' },
      requestId: 'req-auth-1',
      routeKey: route,
      stage: '$default',
      time: '30/Oct/2026:12:00:00 +0000',
      timeEpoch: 1793361600000,
    },
    pathParameters: {},
    stageVariables: {},
  };
}

export const fakeContext = { awsRequestId: 'aws-req-1' } as Context;

export function bodyOf<T = unknown>(result: ApiResult): T {
  return JSON.parse(result.body ?? 'null') as T;
}
