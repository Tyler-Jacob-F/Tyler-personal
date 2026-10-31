import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { type ApiFetch, ApiRequestError, createApiClient } from '@/api/client';
import { useApi } from '@/api/context';
import { fetchGroupMe, groupKeys } from '@/api/group';
import { useMe } from '@/api/me';
import { useAuth } from '@/auth/useAuth';
import { Alert } from '@/components/Alert';
import { AppShell } from '@/components/AppShell';
import { Loading, QueryError } from '@/components/QueryState';
import { GroupNav } from '@/components/GroupNav';
import { KeepMark } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { GroupContext, type GroupContextValue, type GroupViewer, useGroup } from '@/group/context';
import { device } from '@/group/device';
import { GroupShell } from '@/group/GroupShell';

/**
 * The door to `/group/*` (docs/phases/04-group.md "The group slice is small and
 * separate"). A signed-in admin sees the slice inside The Keep's own shell, from the Group
 * place; a signed-in co-lead sees the group's shell with the controls; a device holding
 * the link sees the group's shell as the member it claimed, or as a guest. Nothing else
 * gets in: without a session or a device the page asks for the link.
 */
export function GroupGate() {
  const { state, signOut } = useAuth();
  const [held, setHeld] = useState<{ token: string | null; lost: boolean }>(() => ({
    token: device.load(),
    lost: false,
  }));
  const lost = useCallback(() => {
    device.forget();
    setHeld({ token: null, lost: true });
  }, []);

  if (state.status === 'restoring') return <Loading />;
  if (state.status === 'signedIn') return <SignedInGroup signOut={signOut} />;
  if (held.token) return <DeviceGroup token={held.token} onLost={lost} />;
  return <NeedLink reason={held.lost ? 'lost' : 'none'} />;
}

function SignedInGroup({ signOut }: { signOut(): void }) {
  const me = useMe();
  const api = useApi();
  if (me.isError) return <QueryError queries={[me]} />;
  if (me.isPending) return <Loading />;
  const { caller, displayName } = me.data;
  if (caller.kind !== 'member') return <NeedLink reason="none" />;
  const viewer: GroupViewer =
    caller.role === 'admin'
      ? { kind: 'admin', memberId: caller.id, displayName }
      : caller.role === 'colead'
        ? { kind: 'colead', memberId: caller.id, displayName }
        : { kind: 'signedIn', memberId: caller.id, displayName };
  const value: GroupContextValue = { viewer, api, prefix: '/api', signOut };
  return (
    <GroupContext.Provider value={value}>
      {viewer.kind === 'admin' ? <AppShell /> : <GroupShell />}
    </GroupContext.Provider>
  );
}

/** A device token the API no longer honors: cleared, expired, or from before a rotation that dropped devices. */
function deviceGone(error: unknown): boolean {
  return (
    error instanceof ApiRequestError &&
    (error.status === 401 || (error.status === 403 && error.code === 'http_error'))
  );
}

function DeviceGroup({ token, onLost }: { token: string; onLost(): void }) {
  const api = useMemo<ApiFetch>(() => {
    const base = createApiClient(async () => token);
    return async (path, request) => {
      try {
        return await base(path, request);
      } catch (error) {
        if (deviceGone(error)) onLost();
        throw error;
      }
    };
  }, [token, onLost]);
  const me = useQuery({ queryKey: groupKeys.me(), queryFn: () => fetchGroupMe(api), retry: false });
  if (me.isPending) return <Loading />;
  if (me.isError) {
    return deviceGone(me.error) ? (
      <NeedLink reason="lost" />
    ) : (
      <Alert tone="danger" className="m-6">
        {me.error.message}
      </Alert>
    );
  }
  const { caller, displayName } = me.data;
  if (caller.kind !== 'group') return <NeedLink reason="none" />;
  const viewer: GroupViewer =
    caller.role === 'member' && caller.memberId
      ? { kind: 'member', memberId: caller.memberId, displayName, deviceId: caller.deviceId }
      : { kind: 'guest', deviceId: caller.deviceId };
  const value: GroupContextValue = { viewer, api, prefix: '/api/group', signOut: null };
  return (
    <GroupContext.Provider value={value}>
      <GroupShell />
    </GroupContext.Provider>
  );
}

/** The link landing's frame: the mark, the wordmark, a line or two, one control (docs/design/link-dark-phone.png). */
export function Landing({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
      <KeepMark size={44} className="text-text-strong" />
      <p className="mt-6 font-serif text-[28px] font-medium text-text-strong">The Keep</p>
      {children}
    </main>
  );
}

/** No link on this device, or a device the group no longer knows: one line, and the way back in. */
export function NeedLink({ reason }: { reason: 'none' | 'lost' }) {
  return (
    <Landing>
      <p className="reading mt-3 text-text">
        {reason === 'lost' ? 'This phone is no longer in the group.' : 'You need the group link.'}
      </p>
      <p className="reading mt-2 text-muted">
        {reason === 'lost'
          ? 'Open the group link from the text thread again.'
          : 'Ask Tyler or a co-lead for the current one.'}
      </p>
      <Button asChild variant="ghost" size="sm" className="mt-10 text-muted">
        <Link to="/group/sign-in">Co-lead? Sign in</Link>
      </Button>
    </Landing>
  );
}

/** Below the chrome: the admin gets the group's places as a second row, the way Admin has one. */
export function GroupFrame() {
  const { viewer } = useGroup();
  return (
    <div className="grid gap-8">
      {viewer.kind === 'admin' && <GroupNav />}
      <Outlet />
    </div>
  );
}
