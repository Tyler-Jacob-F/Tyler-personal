import { useClaims, useGroupDocuments, useMembers } from '@/api/group';
import { Loading, QueryError } from '@/components/QueryState';
import { anyError, anyPending } from '@/lib/queries';
import { canEdit, useGroup } from '@/group/context';
import {
  currentSignup,
  eventsOf,
  questionsOf,
  signupsOf,
  thisWeek,
  upcomingEvents,
} from '@/group/format';
import { todayIso } from '@/lib/dates';
import {
  Directory,
  EditOrNew,
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

  const queries = [questions, signups, events, members, ...(sheet ? [claims] : [])];
  if (anyError(queries)) return <QueryError queries={queries} />;
  if (anyPending(queries)) return <Loading />;

  return (
    <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Group">
      <section aria-labelledby="week-heading">
        <SectionHead
          id="week-heading"
          action={
            editor && (
              <EditOrNew item={week?.item} base="/group/questions" newLabel="Write this week’s" />
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
            editor && <EditOrNew item={sheet?.item} base="/group/signups" newLabel="New sign-up" />
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
              <EditOrNew item={next?.item} base="/group/calendar" newLabel="Add a meeting" />
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
          action={editor && <EditOrNew base="/group/members" newLabel="Add a member" />}
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
