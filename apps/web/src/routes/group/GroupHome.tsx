import { useState } from 'react';
import { Link } from 'react-router';
import { useClaims, useGroupDocuments, useMembers } from '@/api/group';
import { Loading, QueryError } from '@/components/QueryState';
import { anyError, anyPending } from '@/lib/queries';
import { canEdit, useGroup } from '@/group/context';
import {
  broughtLine,
  comingThursday,
  currentLiturgy,
  currentSignup,
  eventsOf,
  eyebrowOf,
  guidesOf,
  isTonight,
  liturgyOf,
  meetingOf,
  signupsOf,
  thisWeek,
} from '@/group/format';
import { quietLink } from '@/group/styles';
import { clock, dateLine, dayHeading, dayLine, inRichmond } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { GuideBlock, SheetLink } from '@/routes/group/guide';
import {
  Control,
  Directory,
  EditOrNew,
  MeetingRows,
  SectionHead,
  SignupSheet,
} from '@/routes/group/parts';

/**
 * The group home (docs/design/group-home-*.png; docs/phases/04-group.md "The refresh"):
 * one column, read top to bottom, in an order that turns at 5:00 on meeting day, Richmond
 * time. Until then, and on every other day: Thursday (the coming one, at the standing time
 * and place unless the calendar says otherwise, then the sheet with the viewer's one
 * action), the guide, the members. From then until midnight: Tonight in one
 * line, the guide with its eyebrow as the page's one accent and who brought what at the
 * Table, the members. The admin and co-leads get a quiet control per section.
 */
export function GroupHome() {
  const { viewer } = useGroup();
  const [now] = useState(() => new Date());
  const at = inRichmond(now);
  const today = at.date;
  const guides = useGroupDocuments('guide');
  const liturgy = useGroupDocuments('liturgy');
  const signups = useGroupDocuments('signup');
  const events = useGroupDocuments('event');
  const members = useMembers();
  const week = guides.data ? thisWeek(guidesOf(guides.data.items), today) : null;
  const fixed = liturgy.data ? currentLiturgy(liturgyOf(liturgy.data.items)) : null;
  const sheet = signups.data ? currentSignup(signupsOf(signups.data.items), today) : null;
  const claims = useClaims(sheet?.item.document.id ?? null);
  const thursday = comingThursday(today, sheet, events.data ? eventsOf(events.data.items) : []);
  const laterSheet = thursday.later
    ? (signupsOf(signups.data?.items ?? []).find(
        (s) => s.frontmatter.date === thursday.later!.frontmatter.date,
      ) ?? null)
    : null;
  const editor = canEdit(viewer);

  const queries = [guides, liturgy, signups, events, members, ...(sheet ? [claims] : [])];
  if (anyError(queries)) return <QueryError queries={queries} />;
  if (anyPending(queries)) return <Loading />;

  const meeting = meetingOf(thursday.date, thursday.event, fixed?.frontmatter ?? null);
  const tonight = isTonight(thursday.date, at);
  const brought = sheet ? broughtLine(sheet.frontmatter.slots, claims.data?.items ?? []) : null;

  const guideSection = (
    <section aria-labelledby="guide-heading">
      <SectionHead
        id="guide-heading"
        accent={tonight}
        action={
          editor && <EditOrNew item={week?.item} base="/group/guide" newLabel="Write this week’s" />
        }
      >
        {week ? eyebrowOf(week.frontmatter) || 'The guide' : 'The guide'}
      </SectionHead>
      {week ? (
        <GuideBlock
          guide={week}
          liturgy={fixed?.frontmatter ?? null}
          table={
            tonight ? (
              brought && <p className="mt-2 text-[15px] text-muted">{brought}</p>
            ) : sheet ? (
              <SheetLink to="#table">The sheet is above</SheetLink>
            ) : null
          }
        />
      ) : (
        <p className="reading mt-3 text-muted italic">No guide yet this week.</p>
      )}
    </section>
  );

  const membersSection = (
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
  );

  const meetingControl = editor && (
    <EditOrNew item={thursday.event?.item} base="/group/calendar" newLabel="Add a meeting" />
  );

  if (tonight) {
    return (
      <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Group">
        <section aria-labelledby="tonight-heading">
          <SectionHead id="tonight-heading" action={meetingControl}>
            Tonight
          </SectionHead>
          <p className="mt-3 text-[17px] text-text">
            {[meeting.time && clock(meeting.time), meeting.place].filter(Boolean).join(' at ')}
            {thursday.event && ` · ${meeting.title}`}
            {' · '}
            <Link to="/group/members" className={cn(quietLink, 'min-h-0')}>
              members
            </Link>
          </p>
        </section>
        {guideSection}
        {membersSection}
      </article>
    );
  }

  return (
    <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Group">
      <section aria-labelledby="meeting-heading">
        <SectionHead id="meeting-heading" action={meetingControl}>
          {dayHeading(thursday.date).weekday}
        </SectionHead>
        <h3 className="mt-1 font-serif text-[26px] leading-tight font-medium text-text-strong tabular-nums">
          {dateLine(thursday.date)}
          {meeting.time && `, ${clock(meeting.time)}`}
        </h3>
        {thursday.event && (
          <p className="mt-1 font-serif text-[20px] text-text-strong">{meeting.title}</p>
        )}
        <div className="mt-3">
          <MeetingRows meeting={meeting} item={thursday.event?.item} when={false} />
        </div>
        <div id="table" className="mt-8">
          {sheet ? (
            <SignupSheet
              signup={sheet}
              claims={claims.data?.items ?? []}
              members={members.data?.items}
              dated={false}
              action={
                editor && (
                  <Control to={`/group/signups/${sheet.item.document.id}/edit`}>
                    Edit the sheet
                  </Control>
                )
              }
            />
          ) : (
            <p className="text-[15px] text-muted italic">
              No sheet for the coming Thursday yet.
              {editor && (
                <>
                  {' '}
                  <Link to="/group/signups/new" className={quietLink}>
                    New sign-up
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
        {thursday.later && (
          <div className="mt-10" role="group" aria-labelledby="later-heading">
            <h4 id="later-heading" className="eyebrow">
              Coming up
            </h4>
            <p className="mt-2 font-serif text-[20px] text-text-strong">
              {thursday.later.frontmatter.title}
            </p>
            <p className="mt-1 text-[15px] text-muted">
              {dayLine(thursday.later.frontmatter.date)}
              {thursday.later.frontmatter.time && `, ${clock(thursday.later.frontmatter.time)}`}
              {' · '}
              <Link
                to={
                  laterSheet ? `/group/signups/${laterSheet.item.document.id}` : '/group/calendar'
                }
                className={cn(quietLink, 'min-h-0')}
              >
                {laterSheet ? 'Sign up' : 'On the calendar'}
              </Link>
            </p>
          </div>
        )}
      </section>
      {guideSection}
      {membersSection}
    </article>
  );
}
