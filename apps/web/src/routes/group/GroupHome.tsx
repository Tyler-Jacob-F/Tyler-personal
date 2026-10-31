import { useClaims, useGroupDocuments, useMembers } from '@/api/group';
import { Alert } from '@/components/Alert';
import { canEdit, useGroup } from '@/group/context';
import {
  currentSignup,
  eventsOf,
  questionsOf,
  signupsOf,
  thisWeek,
  upcomingEvents,
} from '@/group/format';
import { todayIso } from '@/routes/briefs/brief';
import {
  Control,
  Directory,
  MeetingRows,
  QuestionsBlock,
  SectionHead,
  SignupSheet,
} from '@/routes/group/parts';

/**
 * The group home (docs/design/group-home-*.png): one column, read top to bottom. This
 * week's questions; the sign-up for the coming Thursday, with the viewer's one action; the
 * next meeting; the directory. The admin and co-leads get a quiet control per section.
 */
export function GroupHome() {
  const { viewer } = useGroup();
  const today = todayIso();
  const questions = useGroupDocuments('questions');
  const signups = useGroupDocuments('signup');
  const events = useGroupDocuments('event');
  const members = useMembers();
  const week = questions.data ? thisWeek(questionsOf(questions.data.items), today) : null;
  const sheet = signups.data ? currentSignup(signupsOf(signups.data.items), today) : null;
  const claims = useClaims(sheet?.item.document.id ?? null);
  const next = events.data ? upcomingEvents(eventsOf(events.data.items), today)[0] : undefined;
  const editor = canEdit(viewer);

  const pending =
    questions.isPending ||
    signups.isPending ||
    events.isPending ||
    members.isPending ||
    (sheet !== null && claims.isPending);
  const failed = [questions, signups, events, members, claims].find((q) => q.isError);
  if (failed) return <Alert tone="danger">{failed.error!.message}</Alert>;
  if (pending) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Group">
      <section aria-labelledby="week-heading">
        <SectionHead
          id="week-heading"
          action={
            editor && (
              <Control
                to={
                  week ? `/group/questions/${week.item.document.id}/edit` : '/group/questions/new'
                }
              >
                {week ? 'Edit' : 'Write this week’s'}
              </Control>
            )
          }
        >
          This week
        </SectionHead>
        {week ? (
          <QuestionsBlock weekOf={week.frontmatter.weekOf} body={week.item.version.body} />
        ) : (
          <p className="reading mt-3 text-muted italic">No questions yet this week.</p>
        )}
      </section>

      <section aria-labelledby="signup-heading">
        <SectionHead
          id="signup-heading"
          action={
            editor && (
              <Control
                to={sheet ? `/group/signups/${sheet.item.document.id}/edit` : '/group/signups/new'}
              >
                {sheet ? 'Edit' : 'New sign-up'}
              </Control>
            )
          }
        >
          Sign-up
        </SectionHead>
        {sheet ? (
          <SignupSheet
            signup={sheet}
            claims={claims.data?.items ?? []}
            members={members.data?.items}
          />
        ) : (
          <p className="reading mt-3 text-muted italic">No sign-up for the coming Thursday yet.</p>
        )}
      </section>

      <section aria-labelledby="meeting-heading">
        <SectionHead
          id="meeting-heading"
          action={
            editor && (
              <Control
                to={next ? `/group/calendar/${next.item.document.id}/edit` : '/group/calendar/new'}
              >
                {next ? 'Edit' : 'Add a meeting'}
              </Control>
            )
          }
        >
          Next meeting
        </SectionHead>
        <div className="mt-3">
          {next ? (
            <MeetingRows event={next} />
          ) : (
            <p className="reading text-muted italic">Nothing on the calendar yet.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="members-heading">
        <SectionHead
          id="members-heading"
          action={editor && <Control to="/group/members/new">Add a member</Control>}
        >
          Members
        </SectionHead>
        <div className="mt-3">
          <Directory members={members.data!.items} viewer={viewer} />
        </div>
      </section>
    </article>
  );
}
