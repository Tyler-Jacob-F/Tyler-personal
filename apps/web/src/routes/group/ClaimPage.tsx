import type { Member } from '@the-keep/shared';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ApiRequestError } from '@/api/client';
import { useClaimName, useMembers } from '@/api/group';
import { Alert } from '@/components/Alert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ChevronRightIcon } from '@/components/icons';
import { Loading, QueryError } from '@/components/QueryState';
import { focusRing } from '@/components/ui/styles';
import { useGroup } from '@/group/context';
import { phonesLine } from '@/group/format';
import { cn } from '@/lib/utils';

/**
 * "Who are you?" (docs/design/claim-dark-phone.png): unclaimed names first, one tap each;
 * under them the names already on another device, with one confirmation. A device that
 * already holds a name may take another (a shared phone).
 */
export function ClaimPage() {
  const { viewer } = useGroup();
  const navigate = useNavigate();
  const members = useMembers();
  const claim = useClaimName();
  const [asking, setAsking] = useState<Member | null>(null);

  if (viewer.kind !== 'member' && viewer.kind !== 'guest') return <Navigate to="/group" replace />;
  if (members.isError) return <QueryError queries={[members]} />;
  if (members.isPending) return <Loading />;

  const mine = viewer.kind === 'member' ? viewer.memberId : null;
  const unclaimed = members.data.items.filter((m) => m.deviceCount === 0 && m.id !== mine);
  const claimed = members.data.items.filter((m) => m.deviceCount > 0 && m.id !== mine);

  const take = (member: Member, confirm: boolean) =>
    claim.mutate(
      { id: member.id, confirm },
      {
        onSuccess: () => navigate('/group', { replace: true }),
        onError: (error) => {
          if (error instanceof ApiRequestError && error.code === 'already_claimed')
            setAsking(member);
        },
      },
    );

  const row = (member: Member, hint: string | null) => (
    <li key={member.id}>
      <button
        type="button"
        disabled={claim.isPending}
        onClick={() => (hint ? setAsking(member) : take(member, false))}
        className={cn(
          'flex min-h-14 w-full items-center justify-between gap-4 text-left text-[19px] text-text hover:text-text-strong',
          focusRing,
        )}
      >
        <span>{member.displayName}</span>
        {hint ? (
          <span className="text-[15px] text-muted">{hint}</span>
        ) : (
          <ChevronRightIcon width="18" height="18" className="text-muted" />
        )}
      </button>
    </li>
  );

  const refusal =
    claim.error &&
    !(claim.error instanceof ApiRequestError && claim.error.code === 'already_claimed')
      ? claim.error.message
      : null;

  return (
    <article className="mx-auto grid max-w-[42rem] gap-8" aria-label="Who are you?">
      <header>
        <h1 className="page-title">Who are you?</h1>
        <p className="mt-2 text-[17px] text-muted">One tap. This phone will remember.</p>
      </header>
      {refusal && <Alert tone="danger">{refusal}</Alert>}
      {unclaimed.length > 0 && (
        <ul className="divide-y divide-border border-y border-border" aria-label="Names">
          {unclaimed.map((m) => row(m, null))}
        </ul>
      )}
      {claimed.length > 0 && (
        <section aria-labelledby="claimed-heading">
          <h2 id="claimed-heading" className="eyebrow">
            Already on another device
          </h2>
          <p className="mt-1 text-[15px] text-muted">Tap if it is you.</p>
          <ul
            className="mt-3 divide-y divide-border border-y border-border"
            aria-label="Claimed names"
          >
            {claimed.map((m) => row(m, phonesLine(m.deviceCount)))}
          </ul>
        </section>
      )}
      {asking && (
        <ConfirmDialog
          title={`You are ${asking.displayName}, and this phone should be yours too?`}
          confirmLabel="Yes, it is me"
          pending={claim.isPending}
          onConfirm={() => take(asking, true)}
          onCancel={() => setAsking(null)}
        >
          The other device stays signed in. If this is not you, go back and tap your own name.
        </ConfirmDialog>
      )}
    </article>
  );
}
