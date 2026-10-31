import { Link, useParams } from 'react-router';
import { useGroupDocuments } from '@/api/group';
import { Alert } from '@/components/Alert';
import { canEdit, useGroup } from '@/group/context';
import { longDay, questionsOf, thisWeek } from '@/group/format';
import { todayIso } from '@/routes/briefs/brief';
import { quietLink } from '@/group/styles';
import { Control, QuestionsBlock, SectionHead } from '@/routes/group/parts';
import { cn } from '@/lib/utils';

/** This week's questions in full, or one past week by id, with the past weeks listed under it. */
export function QuestionsPage() {
  const { viewer } = useGroup();
  const { id } = useParams();
  const today = todayIso();
  const questions = useGroupDocuments('questions');
  if (questions.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (questions.isError) return <Alert tone="danger">{questions.error.message}</Alert>;
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
              <Control
                to={
                  shown ? `/group/questions/${shown.item.document.id}/edit` : '/group/questions/new'
                }
              >
                {shown ? 'Edit' : 'Write this week’s'}
              </Control>
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

      {(others.length > 0 || editor) && (
        <section aria-labelledby="past-heading">
          <SectionHead
            id="past-heading"
            action={editor && <Control to="/group/questions/new">New week</Control>}
          >
            Other weeks
          </SectionHead>
          {others.length === 0 ? (
            <p className="mt-3 text-[15px] text-muted italic">None yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {others.map((q) => (
                <li key={q.item.document.id}>
                  <Link
                    to={`/group/questions/${q.item.document.id}`}
                    className={cn(
                      quietLink,
                      'flex w-full justify-between gap-4 py-1 text-[17px] no-underline',
                    )}
                  >
                    <span className="font-serif">{longDay(q.frontmatter.weekOf)}</span>
                    <span className="text-[13px] text-muted tabular-nums">
                      {q.frontmatter.weekOf}
                    </span>
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
