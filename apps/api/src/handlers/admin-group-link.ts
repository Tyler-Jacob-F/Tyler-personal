import {
  GROUP_LINK_PATH,
  type GroupLinkStatus,
  rotateGroupLinkRequestSchema,
  type RotateGroupLinkResponse,
} from '@the-keep/shared';
import { type Db, getDb } from '../db/client.js';
import { countLiveDevices, findActiveGroupLink, rotateGroupLink } from '../db/group.js';
import { type ApiHandler, createApi, json, parse } from '../lib/http.js';
import { generateGroupLinkToken, hashSecret } from '../lib/token.js';
import { cognitoIdentity } from '../middleware/identity.js';
import { requireLinkKeeper } from '../middleware/permission.js';

export interface GroupLinkOptions {
  /** Where the link lives: `https://tylerfuqua.com`, from the stack. */
  siteOrigin: string;
}

/**
 * The group link (docs/phases/04-group.md "The group link is the key"): minted once,
 * rotated when it leaks, by the admin or a co-lead signed in through Cognito. These routes
 * have no agent door and no group door: a device holding the link cannot mint another,
 * and no scope reaches here. The token appears in exactly one response, as the URL to
 * paste into the group thread; after that only its hash exists.
 */
export function build(db: Db, { siteOrigin }: GroupLinkOptions): ApiHandler {
  return createApi({
    service: 'admin-group-link',
    identify: { member: cognitoIdentity(db) },
    routes: {
      'GET /api/admin/group-link': async ({ identity }) => {
        requireLinkKeeper(identity.caller);
        const [link, deviceCount] = await Promise.all([
          findActiveGroupLink(db),
          countLiveDevices(db),
        ]);
        const body: GroupLinkStatus = { link, deviceCount };
        return json(200, body);
      },

      'POST /api/admin/group-link': async ({ identity, body, log }) => {
        requireLinkKeeper(identity.caller);
        const { clearDevices } = parse(rotateGroupLinkRequestSchema, body ?? {}, 'link');
        const token = generateGroupLinkToken();
        const link = await rotateGroupLink(db, {
          secretHash: hashSecret(token),
          createdBy: identity.caller.id,
          clearDevices,
        });
        log.info('group link rotated', { linkId: link.id, clearDevices });
        const response: RotateGroupLinkResponse = {
          link,
          token,
          url: `${siteOrigin}${GROUP_LINK_PATH}${token}`,
        };
        return json(201, response);
      },
    },
  });
}

/** The origin the stack sets; a bare fallback keeps a misconfigured Lambda from minting a half URL. */
export function siteOriginFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const origin = env.SITE_ORIGIN;
  if (!origin) throw new Error('SITE_ORIGIN is not set');
  return origin.replace(/\/+$/, '');
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb(), { siteOrigin: siteOriginFromEnv() }))(event, context);
