import type { Context } from 'aws-lambda';
import { type EnterGroupResponse, enterGroupRequestSchema } from '@the-keep/shared';
import { type Db, getDb } from '../db/client.js';
import { createDevice, findGroupLinkByHash } from '../db/group.js';
import {
  type ApiEvent,
  type ApiResult,
  errorResponse,
  json,
  notFound,
  parse,
  parseBody,
} from '../lib/http.js';
import { createLogger } from '../lib/logger.js';
import { generateDeviceToken, hashSecret } from '../lib/token.js';

export type EnterHandler = (event: ApiEvent, context?: Context) => Promise<ApiResult>;

/**
 * `POST /api/group/enter`: the one route with no authorizer, because a device has nothing
 * to present until it has been through it. The link's token comes in the body (so it stays
 * out of access logs); a live link mints a device token, shown once and kept as its hash.
 * An unknown or rotated link is a 404, the same 404, so a leaked old link learns nothing
 * from the difference. The device is a guest until it claims a name.
 */
export function build(db: Db): EnterHandler {
  return async (event, context) => {
    const log = createLogger('group-enter', {
      requestId: event.requestContext?.requestId ?? context?.awsRequestId,
      route: event.routeKey ?? event.requestContext?.routeKey,
      door: 'group',
    });
    const started = Date.now();
    try {
      const { token } = parse(enterGroupRequestSchema, parseBody(event), 'link');
      const link = await findGroupLinkByHash(db, hashSecret(token));
      if (!link || link.rotatedAt) {
        log.info('refused', { reason: link ? 'rotated link' : 'unknown link' });
        throw notFound('group link');
      }
      const deviceToken = generateDeviceToken();
      const device = await createDevice(db, hashSecret(deviceToken));
      log.info('device entered', {
        deviceId: device.id,
        linkId: link.id,
        ms: Date.now() - started,
      });
      const body: EnterGroupResponse = { deviceToken, device };
      return json(201, body);
    } catch (error) {
      return errorResponse(error, log, started);
    }
  };
}

let instance: EnterHandler | undefined;
export const handler: EnterHandler = (event, context) =>
  (instance ??= build(getDb()))(event, context);
