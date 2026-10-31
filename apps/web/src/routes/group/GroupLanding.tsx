import { enterGroupResponseSchema, groupLinkTokenSchema } from '@the-keep/shared';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiRequestError, createApiClient } from '@/api/client';
import { fetchGroupMe } from '@/api/group';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { device } from '@/group/device';
import { Landing } from '@/group/GroupGate';

type State =
  | { kind: 'entering' }
  /** In, and whether this phone still has to tap a name. */
  | { kind: 'in'; guest: boolean }
  | { kind: 'dead' }
  | { kind: 'failed'; message: string };

/**
 * `/g/<token>` (docs/design/link-dark-phone.png): the link becomes a device token, kept on
 * the phone for a year. A phone that already holds a live device token is simply let
 * through, so re-opening the thread's link does not make a second device. A rotated or
 * unknown link gets the dead-link screen. Continue takes a phone that has no name yet to
 * "Who are you?" (Tyler, Oct 31, after opening the link himself: someone who opens it from
 * the thread is there to sign up, so the name comes first), and a phone that has one to
 * the home.
 */
export function GroupLanding() {
  const { token = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'entering' });

  useEffect(() => {
    let cancelled = false;
    const settle = (next: State) => {
      if (!cancelled) setState(next);
    };
    (async () => {
      const held = device.load();
      if (held) {
        try {
          const me = await fetchGroupMe(createApiClient(async () => held));
          return settle({
            kind: 'in',
            guest: me.caller.kind !== 'group' || me.caller.role === 'guest',
          });
        } catch {
          device.forget();
        }
      }
      if (!groupLinkTokenSchema.safeParse(token).success) return settle({ kind: 'dead' });
      try {
        const anonymous = createApiClient(async () => null);
        const entered = await anonymous('/api/group/enter', {
          method: 'POST',
          body: { token },
          schema: enterGroupResponseSchema,
        });
        device.save(entered.deviceToken);
        settle({ kind: 'in', guest: true });
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) settle({ kind: 'dead' });
        else settle({ kind: 'failed', message: (error as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <Landing>
      {state.kind === 'entering' && <p className="reading mt-3 text-muted">One moment…</p>}
      {state.kind === 'in' && (
        <>
          <p className="reading mt-3 text-text">You’re in the group.</p>
          <Button asChild variant="accent" className="mt-10 w-full max-w-72">
            <Link to={state.guest ? '/group/claim' : '/group'}>Continue</Link>
          </Button>
        </>
      )}
      {state.kind === 'dead' && (
        <>
          <p className="reading mt-3 text-text">This link is no longer the group’s.</p>
          <p className="reading mt-2 text-muted">Ask Tyler or a co-lead for the current one.</p>
        </>
      )}
      {state.kind === 'failed' && (
        <Alert tone="danger" className="mt-6 max-w-sm text-left">
          {state.message}
        </Alert>
      )}
    </Landing>
  );
}
