import { useParams } from 'react-router';
import { useClaims, useGroupDocuments, useMembers } from '@/api/group';
import { Loading, QueryError } from '@/components/QueryState';
import { anyError, anyPending } from '@/lib/queries';
import { canEdit, useGroup } from '@/group/context';
import { currentSignup, signupsOf, sortedByDate } from '@/group/format';
import { dayLine, todayIso } from '@/lib/dates';
import { EditOrNew, OtherList, SectionHead, SignupSheet } from '@/routes/group/parts';

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
  const queries = [signups, members, ...(shown ? [claims] : [])];
  if (anyError(queries)) return <QueryError queries={queries} />;
  if (anyPending(queries)) return <Loading />;
  const others = all.filter((s) => s !== shown).reverse();
  const editor = canEdit(viewer);

  return (
    <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Sign-up">
      <section aria-labelledby="sheet-heading">
        <SectionHead
          id="sheet-heading"
          action={
            editor && <EditOrNew item={shown?.item} base="/group/signups" newLabel="New sign-up" />
          }
        >
          Sign-up
        </SectionHead>
        {shown ? (
          <SignupSheet
            signup={shown}
            claims={claims.data?.items ?? []}
            members={members.data?.items}
            heading="h1"
          />
        ) : (
          <p className="reading mt-3 text-muted italic">
            {id ? 'No such sign-up.' : 'No sign-up for the coming Thursday yet.'}
          </p>
        )}
      </section>

      <OtherList
        heading="Other sign-ups"
        newTo={editor ? '/group/signups/new' : undefined}
        newLabel="New sign-up"
        items={others.map((o) => ({
          id: o.item.document.id,
          to: `/group/signups/${o.item.document.id}`,
          title: o.frontmatter.title,
          aside: dayLine(o.frontmatter.date),
        }))}
      />
    </article>
  );
}
