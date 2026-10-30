import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { Context } from 'aws-lambda';
import { type Db, getDb } from '../db/client.js';
import { type ApiEvent, type ApiResult, errorResponse } from '../lib/http.js';
import { createLogger } from '../lib/logger.js';
import { createKeepServer } from '../mcp/server.js';
import { agentIdentity } from '../middleware/identity.js';

export type McpHandler = (event: ApiEvent, context?: Context) => Promise<ApiResult>;

/** An API Gateway (payload 2.0) event as the Fetch Request the MCP transport reads. */
export function toRequest(event: ApiEvent): Request {
  const method = event.requestContext.http.method;
  const host = event.headers.host ?? event.requestContext.domainName;
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers)) if (value) headers.set(name, value);
  const hasBody = method !== 'GET' && method !== 'HEAD' && event.body !== undefined;
  const body = hasBody
    ? event.isBase64Encoded
      ? Buffer.from(event.body!, 'base64')
      : event.body
    : undefined;
  return new Request(`https://${host}${event.rawPath}${query}`, { method, headers, body });
}

/** A Fetch Response, read to the end, as the structured result API Gateway wants. */
export async function fromResponse(response: Response): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  const body = await response.text();
  return { statusCode: response.status, headers, body: body || undefined };
}

/**
 * The MCP server at /mcp: Streamable HTTP, stateless, JSON responses. The Lambda
 * authorizer has already looked the token up; the same agent identity the REST routes use
 * runs the tools, so there is one validation path and nothing to keep between requests.
 */
export function build(db: Db): McpHandler {
  const identify = agentIdentity(db);
  return async (event, context) => {
    const log = createLogger('mcp', {
      requestId: event.requestContext?.requestId ?? context?.awsRequestId,
      route: event.routeKey ?? event.requestContext?.routeKey,
      method: event.requestContext?.http?.method,
      door: 'agent',
    });
    const started = Date.now();
    try {
      // Stateless means no standalone SSE stream to listen on and no session to delete, so
      // anything but a message POST is refused here rather than left to open a stream the
      // Lambda would hold until its timeout.
      if (event.requestContext?.http?.method !== 'POST') {
        log.info('refused', { status: 405, ms: Date.now() - started });
        return {
          statusCode: 405,
          headers: { allow: 'POST', 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Method not allowed: this server is stateless; POST messages to /mcp.',
            },
            id: null,
          }),
        };
      }
      const identity = await identify(event, log);
      const server = createKeepServer(db, identity, log.child({ token: identity.displayName }));
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      try {
        await server.connect(transport);
        const result = await fromResponse(await transport.handleRequest(toRequest(event)));
        log.info('handled', { status: result.statusCode, ms: Date.now() - started });
        return result;
      } finally {
        await server.close();
      }
    } catch (error) {
      return errorResponse(error, log, started);
    }
  };
}

let instance: McpHandler | undefined;
export const handler: McpHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
