import { agentScopeSchema, type Caller } from '@the-keep/shared';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { getMember } from '../db/group.js';
import { type AuthorRef, findAdminMember, findMemberByEmail } from '../db/repositories.js';
import { type ApiEvent, forbidden, unauthorized } from '../lib/http.js';
import type { Logger } from '../lib/logger.js';

/** Who is calling, in the brief's shape, plus what the screens show about them. */
export interface Identity {
  caller: Caller;
  /**
   * The member who owns documents this caller creates: themselves, or the admin for an
   * agent. Null for a device, which never authors a document (permission refuses it first).
   */
  owner: string | null;
  displayName: string;
  /** Agents and devices have none. */
  email: string | null;
}

export type Identify = (event: ApiEvent, log: Logger) => Promise<Identity>;

/**
 * Identity: "who is this". API Gateway has already verified the Cognito JWT, so the
 * email claim is trusted; the member allowlist then says whether that person belongs.
 * Nothing here knows about rings.
 */
export function cognitoIdentity(db: Db): Identify {
  return async (event, log) => {
    const authorizer = event.requestContext?.authorizer;
    const claims = authorizer && 'jwt' in authorizer ? authorizer.jwt?.claims : undefined;
    const email = typeof claims?.email === 'string' ? claims.email : undefined;
    if (!email) throw unauthorized('no verified email on the request');
    const member = await findMemberByEmail(db, email);
    if (!member) {
      log.warn('email not on the member allowlist', { email });
      throw forbidden('not a member');
    }
    return {
      caller: { kind: 'member', id: member.id, role: member.role },
      owner: member.id,
      email: member.email,
      displayName: member.displayName,
    };
  };
}

const agentContextSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  scopes: z.string().transform((raw, ctx) => {
    const parsed = z.array(agentScopeSchema).safeParse(JSON.parse(raw));
    if (!parsed.success) ctx.addIssue({ code: 'custom', message: 'bad scopes' });
    return parsed.success ? parsed.data : [];
  }),
});

/**
 * The agents' door: the Lambda authorizer has already hashed and looked up the token, so
 * its context is trusted the way the JWT claims are. Documents an agent creates belong to
 * the admin, since `document.owner` is a member and the admin is the one who issued the
 * token.
 */
export function agentIdentity(db: Db): Identify {
  return async (event) => {
    const authorizer = event.requestContext?.authorizer;
    const raw = authorizer && 'lambda' in authorizer ? authorizer.lambda : undefined;
    const context = agentContextSchema.safeParse(raw);
    if (!context.success) throw unauthorized('no agent token on the request');
    const admin = await findAdminMember(db);
    if (!admin) throw new Error('no admin member to own agent documents');
    return {
      caller: { kind: 'agent', id: context.data.id, scopes: context.data.scopes },
      owner: admin.id,
      displayName: context.data.name,
      email: null,
    };
  };
}

const groupContextSchema = z.object({
  deviceId: z.uuid(),
  memberId: z.uuid().optional(),
  role: z.enum(['member', 'guest']),
});

/**
 * The group's door: the group authorizer has already looked the device up. A device that
 * has claimed a name is that member for the request; one that has not is a guest who may
 * read and claim. The member row is read again here so a name deleted or renamed since the
 * claim shows as it is now, and a claim on a vanished row falls back to guest.
 */
export function groupIdentity(db: Db): Identify {
  return async (event, log) => {
    const authorizer = event.requestContext?.authorizer;
    const raw = authorizer && 'lambda' in authorizer ? authorizer.lambda : undefined;
    const context = groupContextSchema.safeParse(raw);
    if (!context.success) throw unauthorized('no device on the request');
    const { deviceId, memberId } = context.data;
    const member = memberId ? await getMember(db, memberId) : null;
    if (memberId && !member) log.warn('device claims a member that no longer exists', { memberId });
    return {
      caller: member
        ? { kind: 'group', deviceId, memberId: member.id, role: 'member' }
        : { kind: 'group', deviceId, memberId: null, role: 'guest' },
      owner: null,
      displayName: member?.displayName ?? 'Guest',
      email: null,
    };
  };
}

/**
 * Who a write is recorded against: the member or the agent token. A device is neither, and
 * permission refuses it every document write before this is asked; the throw is the belt
 * to that suspender.
 */
export function writerOf(identity: Identity): { owner: string; author: AuthorRef } {
  const { caller, owner } = identity;
  if (caller.kind === 'group' || owner === null)
    throw forbidden('a device cannot author a document');
  return { owner, author: { kind: caller.kind, id: caller.id } };
}
