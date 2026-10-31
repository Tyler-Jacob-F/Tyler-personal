import {
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  claimMemberRequestSchema,
  createMemberRequestSchema,
  type ListMembersResponse,
  makeColeadRequestSchema,
  type Member,
  updateMemberRequestSchema,
} from '@the-keep/shared';
import { z } from 'zod';
import { type Db, getDb } from '../db/client.js';
import {
  claimMember,
  clearMemberDevices,
  createMember,
  getMember,
  listMemberDevices,
  listMembers,
  makeColead,
  updateMember,
} from '../db/group.js';
import {
  type ApiHandler,
  createApi,
  forbidden,
  HttpError,
  json,
  noContent,
  notFound,
  parse,
} from '../lib/http.js';
import { cognitoIdentity, groupIdentity } from '../middleware/identity.js';
import { authorizeMember, requireAdmin } from '../middleware/permission.js';

const idSchema = z.uuid();

export interface MembersOptions {
  /**
   * Create the Cognito user a new co-lead signs in as. Idempotent: an address already in
   * the pool is fine (a retry after a half-finished promotion).
   */
  createUser(email: string): Promise<void>;
}

/** The real thing: one user in the pool, email verified, no welcome mail (the first code is the welcome). */
export function cognitoUserCreator(client: CognitoIdentityProviderClient, userPoolId: string) {
  return async (email: string): Promise<void> => {
    try {
      await client.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: email,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
          ],
          MessageAction: 'SUPPRESS',
        }),
      );
    } catch (error) {
      if (!(error instanceof UsernameExistsException)) throw error;
    }
  };
}

/**
 * Members as entities (docs/phases/04-group.md "Members are entities"). Two doors: the
 * admin and co-leads through Cognito, devices through the group authorizer. The
 * permission middleware says who may do what to whom; this file only asks it and acts.
 * No agent door: no scope touches a member, ever.
 */
export function build(db: Db, { createUser }: MembersOptions): ApiHandler {
  async function found(rawId: unknown): Promise<Member> {
    const id = parse(idSchema, rawId, 'id');
    const member = await getMember(db, id);
    if (!member) throw notFound('member');
    return member;
  }

  return createApi({
    service: 'members',
    identify: { member: cognitoIdentity(db), group: groupIdentity(db) },
    routes: {
      // The directory, and the "Who are you?" list: every caller who holds the link.
      'GET /api/members': async ({ identity }) => {
        authorizeMember(identity.caller, 'read');
        const body: ListMembersResponse = { items: await listMembers(db) };
        return json(200, body);
      },

      'POST /api/members': async ({ identity, body, log }) => {
        authorizeMember(identity.caller, 'add');
        const input = parse(createMemberRequestSchema, body, 'member');
        const member = await createMember(db, input);
        log.info('member added', { memberId: member.id });
        return json(201, member);
      },

      'GET /api/members/{id}': async ({ identity, params }) => {
        authorizeMember(identity.caller, 'read');
        return json(200, await found(params.id));
      },

      // A member edits their own row; co-leads edit any. The fields are the member's to
      // fill: the name (unknown surnames get filled in here), phone, address, notes.
      'PATCH /api/members/{id}': async ({ identity, params, body, log }) => {
        const member = await found(params.id);
        authorizeMember(identity.caller, 'edit', member.id);
        const input = parse(updateMemberRequestSchema, body, 'member');
        const updated = await updateMember(db, member.id, input);
        log.info('member edited', { memberId: member.id, fields: Object.keys(input) });
        return json(200, updated);
      },

      // "Who are you?": the device takes this name. A name already on another device
      // asks once ("already on another device, tap if it is you"); `confirm` answers it.
      'POST /api/members/{id}/claim': async ({ identity, params, body, log }) => {
        const member = await found(params.id);
        authorizeMember(identity.caller, 'claim', member.id);
        const { caller } = identity;
        if (caller.kind !== 'group') throw forbidden('only a device claims a name');
        const { confirm } = parse(claimMemberRequestSchema, body ?? {}, 'claim');
        const elsewhere = (await listMemberDevices(db, member.id)).filter(
          (d) => d.id !== caller.deviceId,
        );
        if (elsewhere.length > 0 && !confirm) {
          throw new HttpError(
            409,
            'already_claimed',
            `${member.displayName} is already on another device; confirm to claim the name here too`,
          );
        }
        await claimMember(db, caller.deviceId, member.id);
        log.info('member claimed', {
          memberId: member.id,
          deviceId: caller.deviceId,
          alsoOn: elsewhere.length,
        });
        return json(200, (await getMember(db, member.id))!);
      },

      // A lost phone: every device holding this name is refused from its next request.
      'DELETE /api/members/{id}/devices': async ({ identity, params, log }) => {
        const member = await found(params.id);
        authorizeMember(identity.caller, 'clear', member.id);
        const cleared = await clearMemberDevices(db, member.id);
        log.info('member devices cleared', { memberId: member.id, cleared });
        return noContent();
      },

      // Make a co-lead: the admin alone, because it creates a sign-in. The row gets the
      // email and the role first (it checks the conflicts), then the pool gets the user.
      'POST /api/members/{id}/colead': async ({ identity, params, body, log }) => {
        requireAdmin(identity.caller);
        const member = await found(params.id);
        const { email } = parse(makeColeadRequestSchema, body, 'co-lead');
        const promoted = await makeColead(db, member.id, email);
        await createUser(promoted.email!);
        log.info('member made co-lead', { memberId: member.id });
        return json(200, promoted);
      },
    },
  });
}

export function userPoolIdFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const id = env.USER_POOL_ID;
  if (!id) throw new Error('USER_POOL_ID is not set');
  return id;
}

let instance: ApiHandler | undefined;
export const handler: ApiHandler = (event, context) =>
  (instance ??= build(getDb(), {
    createUser: cognitoUserCreator(new CognitoIdentityProviderClient({}), userPoolIdFromEnv()),
  }))(event, context);
