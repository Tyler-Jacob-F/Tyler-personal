import { Link, useParams } from 'react-router';
import { useClaims, useGroupDocuments, useMembers } from '@/api/group';
import { Alert } from '@/components/Alert';
import { canEdit, useGroup } from '@/group/context';
import { currentSignup, dayLine, signupsOf, sortedByDate } from '@/group/format';
import { todayIso } from '@/routes/briefs/brief';
import { quietLink } from '@/group/styles';
import { Control, SectionHead, SignupSheet } from '@/routes/group/parts';
import { cn } from '@/lib/utils';

/** The coming Thursday's sheet, or one by id, with the other sign-ups listed under it. */
export function SignupsPage() {
  const { viewer } = useGroup();
  const { id } = useParams();
  const today = todayIso();
  const signups = useGroupDocuments('signup');
  const members = useMembers();
  const all = signups.data ? sortedByDate(signupsOf(signups.data.items)) : [];
  const current = currentSignup(all, today);
  const shown = id ? (all.find((s) => s.item.document.id === id) ?? null) : current;
  const claims = useClaims(shown?.item.document.id ?? null);
  if (signups.isPending || members.isPending || (shown && claims.isPending))
    return <p className="text-sm text-muted">Loading…</p>;
  if (signups.isError) return <Alert tone="danger">{signups.error.message}</Alert>;
  if (members.isError) return <Alert tone="danger">{members.error.message}</Alert>;
  if (claims.isError) return <Alert tone="danger">{claims.error.message}</Alert>;
  const others = all.filter((s) => s !== shown).reverse();
  const editor = canEdit(viewer);

  return (
    <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Sign-up">
      <section aria-labelledby="sheet-heading">
        <SectionHead
          id="sheet-heading"
          action={
            editor && (
              <Control
                to={shown ? `/group/signups/${shown.item.document.id}/edit` : '/group/signups/new'}
              >
                {shown ? 'Edit' : 'New sign-up'}
              </Control>
            )
          }
        >
          Sign-up
        </SectionHead>
        {shown ? (
          <SignupSheet
            signup={shown}
            claims={claims.data?.items ?? []}
            members={members.data.items}
            heading="h1"
          />
        ) : (
          <p className="reading mt-3 text-muted italic">
            {id ? 'No such sign-up.' : 'No sign-up for the coming Thursday yet.'}
          </p>
        )}
      </section>

      {(others.length > 0 || editor) && (
        <section aria-labelledby="others-heading">
          <SectionHead
            id="others-heading"
            action={editor && <Control to="/group/signups/new">New sign-up</Control>}
          >
            Other sign-ups
          </SectionHead>
          {others.length === 0 ? (
            <p className="mt-3 text-[15px] text-muted italic">None yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {others.map((s) => (
                <li key={s.item.document.id}>
                  <Link
                    to={`/group/signups/${s.item.document.id}`}
                    className={cn(
                      quietLink,
                      'flex w-full justify-between gap-4 py-1 text-[17px] no-underline',
                    )}
                  >
                    <span className="font-serif">{s.frontmatter.title}</span>
                    <span className="text-[13px] text-muted">{dayLine(s.frontmatter.date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
