import { useState } from 'react';
import { Link } from 'react-router';
import { useClaims, useGroupDocuments, useMembers } from '@/api/group';
import { Loading, QueryError } from '@/components/QueryState';
import { anyError, anyPending } from '@/lib/queries';
import { canEdit, useGroup } from '@/group/context';
import {
  broughtLine,
  currentLiturgy,
  currentSignup,
  eventsOf,
  eyebrowOf,
  guidesOf,
  isTonight,
  liturgyOf,
  signupsOf,
  thisWeek,
  upcomingEvents,
} from '@/group/format';
import { quietLink } from '@/group/styles';
import { clock, dateLine, dayHeading, inRichmond } from '@/lib/dates';
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
 * time. Until then, and on every other day: Thursday (the meeting, then the sheet with the
 * viewer's one action), the guide, the members. From then until midnight: Tonight in one
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
  const next = events.data ? upcomingEvents(eventsOf(events.data.items), today)[0] : undefined;
  const editor = canEdit(viewer);

  const queries = [guides, liturgy, signups, events, members, ...(sheet ? [claims] : [])];
  if (anyError(queries)) return <QueryError queries={queries} />;
  if (anyPending(queries)) return <Loading />;

  const tonight = next !== undefined && isTonight(next.frontmatter.date, at);
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

  if (tonight) {
    const { frontmatter, item } = next;
    return (
      <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Group">
        <section aria-labelledby="tonight-heading">
          <SectionHead
            id="tonight-heading"
            action={
              editor && <Control to={`/group/calendar/${item.document.id}/edit`}>Edit</Control>
            }
          >
            Tonight
          </SectionHead>
          <p className="mt-3 text-[17px] text-text">
            {[frontmatter.time && clock(frontmatter.time), frontmatter.place]
              .filter(Boolean)
              .join(' at ')}
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
        <SectionHead
          id="meeting-heading"
          action={
            editor && (
              <EditOrNew item={next?.item} base="/group/calendar" newLabel="Add a meeting" />
            )
          }
        >
          {next ? dayHeading(next.frontmatter.date).weekday : 'Thursday'}
        </SectionHead>
        {next ? (
          <>
            <h3 className="mt-1 font-serif text-[26px] leading-tight font-medium text-text-strong tabular-nums">
              {dateLine(next.frontmatter.date)}
              {next.frontmatter.time && `, ${clock(next.frontmatter.time)}`}
            </h3>
            <div className="mt-3">
              <MeetingRows event={next} when={false} />
            </div>
          </>
        ) : (
          <p className="reading mt-3 text-muted italic">Nothing on the calendar yet.</p>
        )}
        <div id="table" className="mt-8">
          {sheet ? (
            <SignupSheet
              signup={sheet}
              claims={claims.data?.items ?? []}
              members={members.data?.items}
              dated={!next || next.frontmatter.date !== sheet.frontmatter.date}
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
      </section>
      {guideSection}
      {membersSection}
    </article>
  );
}
