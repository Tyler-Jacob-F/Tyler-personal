import { createContext, useContext } from 'react';
import type { ApiFetch } from '@/api/client';

/**
 * Who is looking at the group slice (docs/phases/04-group.md "Four kinds of caller"): the
 * admin and co-leads signed in through Cognito, with the controls; a device that has
 * claimed a name; a device that has not. The legacy `group` role (a signed-in member who
 * is not a co-lead) reads like a device that has no name.
 */
export type GroupViewer =
  | { kind: 'admin'; memberId: string; displayName: string }
  | { kind: 'colead'; memberId: string; displayName: string }
  | { kind: 'signedIn'; memberId: string; displayName: string }
  | { kind: 'member'; memberId: string; displayName: string; deviceId: string }
  | { kind: 'guest'; deviceId: string };

export interface GroupContextValue {
  viewer: GroupViewer;
  /** Bound to the viewer's credential: the Cognito id token or the device token. */
  api: ApiFetch;
  /** `/api` for a signed-in viewer, `/api/group` for a device. */
  prefix: '/api' | '/api/group';
  /** Signed-in viewers can sign out; devices simply close the tab. */
  signOut: (() => void) | null;
}

export const GroupContext = createContext<GroupContextValue | null>(null);

export function useGroup(): GroupContextValue {
  const value = useContext(GroupContext);
  if (!value) throw new Error('useGroup needs a GroupGate above it');
  return value;
}

/** The admin and co-leads write the group's documents and manage members. */
export function canEdit(viewer: GroupViewer): boolean {
  return viewer.kind === 'admin' || viewer.kind === 'colead';
}

/** The member a viewer acts as, if any: the row they claimed, or their own signed-in row. */
export function memberIdOf(viewer: GroupViewer): string | null {
  return viewer.kind === 'guest' ? null : viewer.memberId;
}
