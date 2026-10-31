import { useParams } from 'react-router';
import { useGroupDocuments } from '@/api/group';
import { Loading, QueryError } from '@/components/QueryState';
import { canEdit, useGroup } from '@/group/context';
import { questionsOf, thisWeek } from '@/group/format';
import { longDay, todayIso } from '@/lib/dates';
import { EditOrNew, OtherList, QuestionsBlock, SectionHead } from '@/routes/group/parts';

/** This week's questions in full, or one past week by id, with the past weeks listed under it. */
export function QuestionsPage() {
  const { viewer } = useGroup();
  const { id } = useParams();
  const today = todayIso();
  const questions = useGroupDocuments('questions');
  if (questions.isError) return <QueryError queries={[questions]} />;
  if (questions.isPending) return <Loading />;
  const all = questionsOf(questions.data.items).sort((a, b) =>
    b.frontmatter.weekOf.localeCompare(a.frontmatter.weekOf),
  );
  const current = thisWeek(all, today);
  const shown = id ? (all.find((q) => q.item.document.id === id) ?? null) : current;
  const others = all.filter((q) => q !== shown);
  const editor = canEdit(viewer);

  return (
    <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Questions">
      <section aria-labelledby="questions-heading">
        <SectionHead
          id="questions-heading"
          action={
            editor && (
              <EditOrNew item={shown?.item} base="/group/questions" newLabel="Write this week’s" />
            )
          }
        >
          {shown && shown === current ? 'This week' : 'Questions'}
        </SectionHead>
        {shown ? (
          <QuestionsBlock weekOf={shown.frontmatter.weekOf} body={shown.item.version.body} />
        ) : (
          <p className="reading mt-3 text-muted italic">
            {id ? 'No such week.' : 'No questions yet this week.'}
          </p>
        )}
      </section>

      <OtherList
        heading="Other weeks"
        newTo={editor ? '/group/questions/new' : undefined}
        newLabel="New week"
        items={others.map((q) => ({
          id: q.item.document.id,
          to: `/group/questions/${q.item.document.id}`,
          title: longDay(q.frontmatter.weekOf),
          aside: q.frontmatter.weekOf,
        }))}
      />
    </article>
  );
}
