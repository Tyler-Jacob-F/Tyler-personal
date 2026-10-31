import type { ListMembersResponse } from '@the-keep/shared';
import type { Db } from '../db/client.js';
import { listMembers } from '../db/group.js';
import type { Identity } from '../middleware/identity.js';
import { authorizeMember } from '../middleware/permission.js';

/** The directory, for everyone who holds the link and for an agent with `read:members`. */
export async function listMembersFor(db: Db, identity: Identity): Promise<ListMembersResponse> {
  authorizeMember(identity.caller, 'read');
  return { items: await listMembers(db) };
}
