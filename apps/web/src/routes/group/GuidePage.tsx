import { translationNames } from '@the-keep/shared';
import { useParams } from 'react-router';
import { useGroupDocuments } from '@/api/group';
import { Loading, QueryError } from '@/components/QueryState';
import { anyError, anyPending } from '@/lib/queries';
import { canEdit, useGroup } from '@/group/context';
import { currentLiturgy, eyebrowOf, guidesOf, liturgyOf, thisWeek } from '@/group/format';
import { inRichmond, shortDay } from '@/lib/dates';
import { GuideBlock, SheetLink } from '@/routes/group/guide';
import { Control, EditOrNew, OtherList, SectionHead } from '@/routes/group/parts';

/** This week's guide in full, or one past week by id, with the other weeks listed under it. */
export function GuidePage() {
  const { viewer } = useGroup();
  const { id } = useParams();
  const today = inRichmond().date;
  const guides = useGroupDocuments('guide');
  const liturgy = useGroupDocuments('liturgy');
  const queries = [guides, liturgy];
  if (anyError(queries)) return <QueryError queries={queries} />;
  if (anyPending(queries)) return <Loading />;
  const all = guidesOf(guides.data!.items).sort((a, b) =>
    b.frontmatter.weekOf.localeCompare(a.frontmatter.weekOf),
  );
  const fixed = currentLiturgy(liturgyOf(liturgy.data!.items));
  const current = thisWeek(all, today);
  const shown = id ? (all.find((g) => g.item.document.id === id) ?? null) : current;
  const others = all.filter((g) => g !== shown);
  const editor = canEdit(viewer);

  return (
    <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Guide">
      <section aria-labelledby="guide-heading">
        <SectionHead
          id="guide-heading"
          action={
            editor && (
              <EditOrNew item={shown?.item} base="/group/guide" newLabel="Write this week’s" />
            )
          }
        >
          {shown ? eyebrowOf(shown.frontmatter) || 'The guide' : 'The guide'}
        </SectionHead>
        {shown ? (
          <GuideBlock
            guide={shown}
            liturgy={fixed?.frontmatter ?? null}
            heading="h1"
            table={<SheetLink to="/group/signups">The sheet</SheetLink>}
          />
        ) : (
          <p className="reading mt-3 text-muted italic">
            {id ? 'No such week.' : 'No guide yet this week.'}
          </p>
        )}
      </section>

      <OtherList
        heading="Other weeks"
        newTo={editor ? '/group/guide/new' : undefined}
        newLabel="New week"
        items={others.map((g) => ({
          id: g.item.document.id,
          to: `/group/guide/${g.item.document.id}`,
          title: g.frontmatter.title,
          aside: shortDay(g.frontmatter.weekOf),
        }))}
      />

      {editor && (
        <section aria-labelledby="liturgy-heading">
          <SectionHead
            id="liturgy-heading"
            action={<Control to="/group/liturgy/edit">{fixed ? 'Edit' : 'Set it up'}</Control>}
          >
            The fixed liturgy
          </SectionHead>
          <p className="mt-3 text-[15px] text-muted">
            {fixed
              ? `What repeats every week: the collect before the reading, the songbook line, the Lord’s Prayer, the final collect. Readings open in the ${translationNames[fixed.frontmatter.translation]} until a reader picks another.`
              : 'Not set yet: the guide shows only what the week brings until it is.'}
          </p>
        </section>
      )}
    </article>
  );
}
