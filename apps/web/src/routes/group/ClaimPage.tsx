import type { Member } from '@the-keep/shared';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ApiRequestError } from '@/api/client';
import { useClaimName, useMembers } from '@/api/group';
import { Alert } from '@/components/Alert';
import { ChevronRightIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { focusRing } from '@/components/ui/styles';
import { useGroup } from '@/group/context';
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
  if (members.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (members.isError) return <Alert tone="danger">{members.error.message}</Alert>;

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

  const phones = (n: number) => (n === 1 ? 'a phone' : n === 2 ? 'two phones' : `${n} phones`);
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
            {claimed.map((m) => row(m, phones(m.deviceCount)))}
          </ul>
        </section>
      )}
      {asking && (
        <div
          role="dialog"
          aria-labelledby="confirm-heading"
          className="rounded-lg border border-border bg-surface px-5 py-5"
        >
          <h2
            id="confirm-heading"
            className="font-serif text-[22px] leading-snug font-medium text-text-strong"
          >
            You are {asking.displayName}, and this phone should be yours too?
          </h2>
          <p className="mt-3 text-[15px] text-muted">
            The other device stays signed in. If this is not you, go back and tap your own name.
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <Button onClick={() => setAsking(null)}>Back</Button>
            <Button variant="accent" disabled={claim.isPending} onClick={() => take(asking, true)}>
              Yes, it is me
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
