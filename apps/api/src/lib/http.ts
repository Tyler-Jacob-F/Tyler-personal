import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyEventV2WithLambdaAuthorizer,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import { ZodError, z } from 'zod';
import type { AgentAuthorizerContext } from '../auth/agent-authorizer.js';
import type { GroupAuthorizerContext } from '../auth/group-authorizer.js';
import { ConflictError, NotFoundError } from '../db/repositories.js';
import { createLogger, type Logger } from './logger.js';

/** A request through the people's door: the Cognito JWT authorizer verified it. */
export type MemberEvent = APIGatewayProxyEventV2WithJWTAuthorizer;
/** A request through the agents' door: the Lambda authorizer looked the token up. */
export type AgentEvent = APIGatewayProxyEventV2WithLambdaAuthorizer<AgentAuthorizerContext>;
/** A request through the group's door: the group authorizer looked the device up. */
export type GroupEvent = APIGatewayProxyEventV2WithLambdaAuthorizer<GroupAuthorizerContext>;
export type ApiEvent = MemberEvent | AgentEvent | GroupEvent;
export type ApiResult = APIGatewayProxyStructuredResultV2;

/**
 * Three doors, one set of handlers (docs/DESIGN.md "Implementation notes"). `/api/agent/*`
 * and `/api/group/*` mirror `/api/*`; the prefix says which identity middleware runs, and
 * the route key is normalized so a handler registers each route once.
 */
export type Door = 'member' | 'agent' | 'group';
export const AGENT_PREFIX = '/api/agent/';
export const GROUP_PREFIX = '/api/group/';

export function doorOf(routeKey: string): { door: Door; routeKey: string } {
  const [method = '', path = ''] = routeKey.split(' ');
  if (path.startsWith(AGENT_PREFIX)) {
    return { door: 'agent', routeKey: `${method} /api/${path.slice(AGENT_PREFIX.length)}` };
  }
  if (path.startsWith(GROUP_PREFIX)) {
    return { door: 'group', routeKey: `${method} /api/${path.slice(GROUP_PREFIX.length)}` };
  }
  return { door: 'member', routeKey };
}

/** An error the client caused, carried with the status it deserves. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: Array<{ path: string; message: string }>;

  constructor(
    status: number,
    code: string,
    message: string,
    issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export const badRequest = (message: string, issues?: HttpError['issues']) =>
  new HttpError(400, 'bad_request', message, issues);
export const unauthorized = (message = 'sign in required') =>
  new HttpError(401, 'unauthorized', message);
export const forbidden = (message = 'not allowed') => new HttpError(403, 'forbidden', message);
export const notFound = (what = 'resource') => new HttpError(404, 'not_found', `${what} not found`);

export function json(status: number, body: unknown): ApiResult {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export const noContent = (): ApiResult => ({
  statusCode: 204,
  headers: { 'cache-control': 'no-store' },
});

function zodIssues(error: ZodError) {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

/** Parse with a schema, turning validation failure into a 400 with the field issues. */
export function parse<T extends z.ZodType>(schema: T, value: unknown, what: string): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw badRequest(`invalid ${what}`, zodIssues(result.error));
  return result.data;
}

const uuidSchema = z.uuid();

/** A path parameter that must be a uuid, or a 400 naming it. */
export function parseId(value: unknown, what = 'id'): string {
  return parse(uuidSchema, value, what);
}

export function parseBody(event: ApiEvent): unknown {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest('body is not valid JSON');
  }
}

export interface RouteContext<TIdentity> {
  event: ApiEvent;
  identity: TIdentity;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  log: Logger;
}

export type Route<TIdentity> = (ctx: RouteContext<TIdentity>) => Promise<ApiResult>;

export interface ApiOptions<TIdentity> {
  service: string;
  /**
   * Who is calling, per door; runs before any route. Throw an HttpError to refuse. A door
   * with no identifier is closed: a request through it is a 401 whatever the route.
   */
  identify: Partial<Record<Door, (event: ApiEvent, log: Logger) => Promise<TIdentity>>>;
  routes: Record<string, Route<TIdentity>>;
}

export type ApiHandler = (event: ApiEvent, context?: Context) => Promise<ApiResult>;

/**
 * One Lambda per resource: a map of HTTP API route keys ("GET /api/documents/{id}") to
 * handlers, with identity resolved first and every error turned into a JSON response.
 */
export function createApi<TIdentity>({
  service,
  identify,
  routes,
}: ApiOptions<TIdentity>): ApiHandler {
  return async (event, context) => {
    const requested = event.routeKey ?? event.requestContext?.routeKey ?? '';
    const { door, routeKey } = doorOf(requested);
    const log = createLogger(service, {
      requestId: event.requestContext?.requestId ?? context?.awsRequestId,
      route: requested,
      door,
    });
    const started = Date.now();
    try {
      const route = routes[routeKey];
      if (!route) throw notFound('route');
      const identifyAt = identify[door];
      if (!identifyAt) throw unauthorized(`no ${door} door on this route`);
      const identity = await identifyAt(event, log);
      const result = await route({
        event,
        identity,
        params: (event.pathParameters ?? {}) as Record<string, string>,
        query: (event.queryStringParameters ?? {}) as Record<string, string>,
        body: parseBody(event),
        log,
      });
      log.info('handled', { status: result.statusCode, ms: Date.now() - started });
      return result;
    } catch (error) {
      return errorResponse(error, log, started);
    }
  };
}

/**
 * The request wrapper for a Lambda that is not a route map (the MCP server, the enter
 * route): the same logger fields, timing and error responses `createApi` gives its routes.
 */
export async function handleRequest(
  service: string,
  event: ApiEvent,
  context: Context | undefined,
  run: (log: Logger, started: number) => Promise<ApiResult>,
  fields: Record<string, unknown> = {},
): Promise<ApiResult> {
  const log = createLogger(service, {
    requestId: event.requestContext?.requestId ?? context?.awsRequestId,
    route: event.routeKey ?? event.requestContext?.routeKey,
    ...fields,
  });
  const started = Date.now();
  try {
    return await run(log, started);
  } catch (error) {
    return errorResponse(error, log, started);
  }
}

export function errorResponse(error: unknown, log: Logger, started: number): ApiResult {
  if (error instanceof HttpError) {
    log.info('refused', { status: error.status, code: error.code, ms: Date.now() - started });
    return json(error.status, { error: error.code, message: error.message, issues: error.issues });
  }
  if (error instanceof ZodError) {
    return json(400, { error: 'bad_request', message: 'invalid input', issues: zodIssues(error) });
  }
  if (error instanceof NotFoundError) {
    return json(404, { error: 'not_found', message: error.message });
  }
  if (error instanceof ConflictError) {
    return json(409, { error: 'conflict', message: error.message });
  }
  log.error('unhandled', { error, ms: Date.now() - started });
  return json(500, { error: 'internal', message: 'something went wrong' });
}
