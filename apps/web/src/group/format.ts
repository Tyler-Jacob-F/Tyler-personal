import {
  currentWeek,
  type DocumentWithVersion,
  type EventFrontmatter,
  eventFrontmatterSchema,
  type GuideFrontmatter,
  guideFrontmatterSchema,
  type LiturgyFrontmatter,
  liturgyFrontmatterSchema,
  type SignupClaim,
  type SignupFrontmatter,
  signupFrontmatterSchema,
  type SignupSlot,
} from '@the-keep/shared';
import { addDays, nextWeekday } from '@/lib/dates';
import { frontmatterOf } from '@/lib/frontmatter';

/** A group document with its frontmatter parsed; `null` when a stored version no longer fits. */
export interface Typed<T> {
  item: DocumentWithVersion;
  frontmatter: T;
}

function typed<T>(items: DocumentWithVersion[], parse: (fm: unknown) => T | null): Typed<T>[] {
  return items.flatMap((item) => {
    const frontmatter = parse(item.version.frontmatter);
    return frontmatter ? [{ item, frontmatter }] : [];
  });
}

export const guidesOf = (items: DocumentWithVersion[]) =>
  typed<GuideFrontmatter>(items, frontmatterOf(guideFrontmatterSchema));
export const liturgyOf = (items: DocumentWithVersion[]) =>
  typed<LiturgyFrontmatter>(items, frontmatterOf(liturgyFrontmatterSchema));
export const signupsOf = (items: DocumentWithVersion[]) =>
  typed<SignupFrontmatter>(items, frontmatterOf(signupFrontmatterSchema));
export const eventsOf = (items: DocumentWithVersion[]) =>
  typed<EventFrontmatter>(items, frontmatterOf(eventFrontmatterSchema));

/** "This week's" guide: the newest within six days ahead (`currentWeek` in shared). */
export function thisWeek(guides: Typed<GuideFrontmatter>[], today: string) {
  const picked = currentWeek(
    guides.map((g) => ({ weekOf: g.frontmatter.weekOf, g })),
    today,
  );
  return picked?.g ?? null;
}

/** The group's one liturgy document: the newest, should a second ever be made. */
export function currentLiturgy(items: Typed<LiturgyFrontmatter>[]) {
  return (
    [...items].sort((a, b) =>
      b.item.document.createdAt.localeCompare(a.item.document.createdAt),
    )[0] ?? null
  );
}

const weekWords = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
];

/** "Sanctuary · Week four": the guide's eyebrow, from whichever of series and week it has. */
export function eyebrowOf(guide: Pick<GuideFrontmatter, 'series' | 'week'>): string {
  const week = guide.week ? `Week ${weekWords[guide.week - 1] ?? guide.week}` : null;
  return [guide.series, week].filter(Boolean).join(' · ');
}

/** The group meets on Thursdays; the calendar holds only the nights that differ. */
export const MEETING_DAY = 4;
/** How far the home looks past the coming Thursday for a night worth naming. */
export const LOOKAHEAD_DAYS = 30;

/**
 * The coming Thursday as the home anchors on it (Tyler, Nov 2: the next event is not the
 * next meeting). The sheet's date when there is a sheet; else the next Thursday on or
 * after today. Beside it, the event on that date if the calendar has one, and the first
 * event past it within a month, so a Friendsgiving two weeks out is named (and signed up
 * for) without becoming the meeting.
 */
export function comingThursday(
  today: string,
  sheet: Typed<SignupFrontmatter> | null,
  events: Typed<EventFrontmatter>[],
): {
  date: string;
  event: Typed<EventFrontmatter> | null;
  later: Typed<EventFrontmatter> | null;
} {
  const date = sheet?.frontmatter.date ?? nextWeekday(today, MEETING_DAY);
  const upcoming = upcomingEvents(events, today);
  return {
    date,
    event: upcoming.find((e) => e.frontmatter.date === date) ?? null,
    later:
      upcoming.find(
        (e) => e.frontmatter.date > date && e.frontmatter.date <= addDays(today, LOOKAHEAD_DAYS),
      ) ?? null,
  };
}

/** The evening as the page states it: the event's own when and where, else the standing meeting's. */
export function meetingOf(
  date: string,
  event: Typed<EventFrontmatter> | null,
  liturgy: LiturgyFrontmatter | null,
): EventFrontmatter {
  return {
    title: event?.frontmatter.title ?? 'Small group',
    date,
    time: event?.frontmatter.time ?? liturgy?.meetsAt,
    place: event?.frontmatter.place ?? liturgy?.place,
    notes: event?.frontmatter.notes,
  };
}

/** From 5:00 on meeting day until midnight, Richmond time, the page is the evening's. */
export function isTonight(eventDate: string, clock: { date: string; hour: number }): boolean {
  return eventDate === clock.date && clock.hour >= 17;
}

/** "Main John · Salad — · Dessert Kelly, Taylor": who brought what, for the evening's Table. */
export function broughtLine(slots: SignupSlot[], claims: SignupClaim[]): string {
  return slots
    .map((slot) => {
      const names = claims.filter((c) => c.slot === slot.label).map((c) => c.memberName);
      return `${slot.label} ${names.length ? names.join(', ') : '—'}`;
    })
    .join(' · ');
}

/** By date, soonest first; ties by newest document. */
function byDate<T extends { date: string }>(a: Typed<T>, b: Typed<T>) {
  return (
    a.frontmatter.date.localeCompare(b.frontmatter.date) ||
    b.item.document.createdAt.localeCompare(a.item.document.createdAt)
  );
}

/** The sign-up for the coming Thursday: the earliest dated today or later. */
export function currentSignup(signups: Typed<SignupFrontmatter>[], today: string) {
  return signups.filter((s) => s.frontmatter.date >= today).sort(byDate)[0] ?? null;
}

/** Upcoming events, soonest first. */
export function upcomingEvents(events: Typed<EventFrontmatter>[], today: string) {
  return events.filter((e) => e.frontmatter.date >= today).sort(byDate);
}

/** Past events, most recent first. */
export function pastEvents(events: Typed<EventFrontmatter>[], today: string) {
  return events.filter((e) => e.frontmatter.date < today).sort((a, b) => byDate(b, a));
}

export function sortedByDate<T extends { date: string }>(items: Typed<T>[]) {
  return [...items].sort(byDate);
}

/** "one", "up to 3": a slot's capacity as the render words it. */
export function capacityLine(capacity: number): string {
  return capacity === 1 ? 'one' : `up to ${capacity}`;
}

/** "a phone", "two phones", "3 phones": how many devices hold a name, as the render words it. */
export function phonesLine(n: number): string {
  if (n === 1) return 'a phone';
  if (n === 2) return 'two phones';
  return `${n} phones`;
}

/** A `tel:` href for a phone as a member typed it. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** An iCalendar file for one meeting, as a data URL for "Add to calendar". */
export function icsUrl(event: EventFrontmatter, uid: string): string {
  const stamp = event.date.replace(/-/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Keep//Group//EN',
    'BEGIN:VEVENT',
    `UID:${uid}@tylerfuqua.com`,
    `DTSTAMP:${stamp}T000000Z`,
    event.time
      ? `DTSTART:${stamp}T${event.time.replace(':', '')}00`
      : `DTSTART;VALUE=DATE:${stamp}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    ...(event.place ? [`LOCATION:${escapeIcs(event.place)}`] : []),
    ...(event.notes ? [`DESCRIPTION:${escapeIcs(event.notes)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
