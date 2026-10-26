import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import { ZodError, type z } from 'zod';
import { NotFoundError } from '../db/repositories.js';
import { createLogger, type Logger } from './logger.js';

export type ApiEvent = APIGatewayProxyEventV2WithJWTAuthorizer;
export type ApiResult = APIGatewayProxyStructuredResultV2;

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
  /** Who is calling; runs before any route. Throw an HttpError to refuse. */
  identify(event: ApiEvent, log: Logger): Promise<TIdentity>;
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
    const routeKey = event.routeKey ?? event.requestContext?.routeKey ?? '';
    const log = createLogger(service, {
      requestId: event.requestContext?.requestId ?? context?.awsRequestId,
      route: routeKey,
    });
    const started = Date.now();
    try {
      const route = routes[routeKey];
      if (!route) throw notFound('route');
      const identity = await identify(event, log);
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

function errorResponse(error: unknown, log: Logger, started: number): ApiResult {
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
  log.error('unhandled', { error, ms: Date.now() - started });
  return json(500, { error: 'internal', message: 'something went wrong' });
}
