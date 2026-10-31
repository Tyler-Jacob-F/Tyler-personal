import { useGroupDocuments } from '@/api/group';
import { Alert } from '@/components/Alert';
import { canEdit, useGroup } from '@/group/context';
import { eventsOf, pastEvents, upcomingEvents, whenLine } from '@/group/format';
import { todayIso } from '@/routes/briefs/brief';
import { Control, MeetingRows, SectionHead } from '@/routes/group/parts';

/** The calendar is the list of upcoming events (docs/phases/04-group.md), the past folded under. */
export function CalendarPage() {
  const { viewer } = useGroup();
  const today = todayIso();
  const events = useGroupDocuments('event');
  if (events.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (events.isError) return <Alert tone="danger">{events.error.message}</Alert>;
  const all = eventsOf(events.data.items);
  const upcoming = upcomingEvents(all, today);
  const past = pastEvents(all, today);
  const editor = canEdit(viewer);

  return (
    <article className="mx-auto grid max-w-[42rem] gap-12" aria-label="Calendar">
      <section aria-labelledby="upcoming-heading">
        <SectionHead
          id="upcoming-heading"
          action={editor && <Control to="/group/calendar/new">Add a meeting</Control>}
        >
          Coming up
        </SectionHead>
        {upcoming.length === 0 ? (
          <p className="reading mt-3 text-muted italic">Nothing on the calendar yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {upcoming.map((event) => (
              <li key={event.item.document.id} className="py-5 first:pt-0">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-serif text-[22px] font-medium text-text-strong">
                    {event.frontmatter.title}
                  </h2>
                  {editor && (
                    <Control to={`/group/calendar/${event.item.document.id}/edit`}>Edit</Control>
                  )}
                </div>
                <div className="mt-2">
                  <MeetingRows event={event} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-heading">
          <SectionHead id="past-heading">Past</SectionHead>
          <ul className="mt-3 divide-y divide-border border-y border-border">
            {past.map((event) => (
              <li
                key={event.item.document.id}
                className="flex justify-between gap-4 py-3 text-[15px] text-muted"
              >
                <span>{event.frontmatter.title}</span>
                <span className="shrink-0 tabular-nums">
                  {whenLine(event.frontmatter.date, event.frontmatter.time)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
