import type {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerResult,
  APIGatewaySimpleAuthorizerWithContextResult,
} from 'aws-lambda';
import { DEVICE_LIFETIME_DAYS, deviceTokenSchema } from '@the-keep/shared';
import { type Db, getDb } from '../db/client.js';
import { findDeviceByHash, touchDevice } from '../db/group.js';
import { createLogger } from '../lib/logger.js';
import { hashSecret } from '../lib/token.js';
import { bearerToken } from './agent-authorizer.js';

/**
 * What the group authorizer hands the route Lambda. API Gateway carries only strings, and
 * an unclaimed device has no member, so `memberId` is left out rather than sent empty.
 */
export interface GroupAuthorizerContext {
  deviceId: string;
  memberId?: string;
  role: 'member' | 'guest';
}

export type GroupAuthorizerResult =
  | APIGatewaySimpleAuthorizerResult
  | APIGatewaySimpleAuthorizerWithContextResult<GroupAuthorizerContext>;

export type GroupAuthorizer = (
  event: APIGatewayRequestAuthorizerEventV2,
) => Promise<GroupAuthorizerResult>;

const deny: APIGatewaySimpleAuthorizerResult = { isAuthorized: false };

export interface GroupAuthorizerOptions {
  /** Injected by tests; production uses the clock. */
  now?: () => Date;
}

/** A device entered on `createdAt` is good for a year (docs/phases/04-group.md "Sessions are a year"). */
export function deviceExpired(createdAt: string, now: Date): boolean {
  return now.getTime() - new Date(createdAt).getTime() > DEVICE_LIFETIME_DAYS * 86_400_000;
}

/**
 * The group's door (docs/phases/04-group.md "Group door"): the Lambda authorizer on
 * `/api/group/*`, invoked on every request that carries an `Authorization` header. Hash
 * the presented device token, look the device up, refuse an unknown, cleared or year-old
 * device, record the use, and pass `{ deviceId, memberId?, role }` on as context. No
 * result cache, so clearing a lost phone takes effect at once. A refusal is the gateway's
 * 403 with no body of ours; the client reads a bodiless 403 on this door as "this device
 * is no longer in the group" and forgets its token. The authorizer knows nothing about
 * rings or documents; that is the permission middleware's job.
 */
export function build(
  db: Db,
  { now = () => new Date() }: GroupAuthorizerOptions = {},
): GroupAuthorizer {
  return async (event) => {
    const log = createLogger('group-authorizer', {
      requestId: event.requestContext?.requestId,
      route: event.routeKey,
    });
    const header = event.headers?.authorization ?? event.headers?.Authorization;
    const secret = bearerToken(header);
    if (!secret) {
      log.info('refused', { reason: 'no device token' });
      return deny;
    }
    if (!deviceTokenSchema.safeParse(secret).success) {
      log.info('refused', { reason: 'not a device token', length: secret.length });
      return deny;
    }
    const device = await findDeviceByHash(db, hashSecret(secret));
    if (!device) {
      log.info('refused', { reason: 'unknown device' });
      return deny;
    }
    if (device.clearedAt) {
      log.warn('refused', { reason: 'cleared device', deviceId: device.id });
      return deny;
    }
    if (deviceExpired(device.createdAt, now())) {
      log.info('refused', { reason: 'expired device', deviceId: device.id });
      return deny;
    }
    await touchDevice(db, device.id);
    const role = device.memberId ? 'member' : 'guest';
    log.info('accepted', { deviceId: device.id, memberId: device.memberId, role });
    return {
      isAuthorized: true,
      context: {
        deviceId: device.id,
        ...(device.memberId ? { memberId: device.memberId } : {}),
        role,
      },
    };
  };
}

let instance: GroupAuthorizer | undefined;
export const handler: GroupAuthorizer = (event) => (instance ??= build(getDb()))(event);
