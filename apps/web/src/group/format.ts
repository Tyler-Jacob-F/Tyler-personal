import {
  currentQuestions,
  type DocumentWithVersion,
  type EventFrontmatter,
  eventFrontmatterSchema,
  type QuestionsFrontmatter,
  questionsFrontmatterSchema,
  type SignupFrontmatter,
  signupFrontmatterSchema,
} from '@the-keep/shared';

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

const safe =
  <T>(schema: { safeParse(v: unknown): { success: boolean; data?: T } }) =>
  (fm: unknown) => {
    const parsed = schema.safeParse(fm);
    return parsed.success ? (parsed.data as T) : null;
  };

export const questionsOf = (items: DocumentWithVersion[]) =>
  typed<QuestionsFrontmatter>(items, safe(questionsFrontmatterSchema));
export const signupsOf = (items: DocumentWithVersion[]) =>
  typed<SignupFrontmatter>(items, safe(signupFrontmatterSchema));
export const eventsOf = (items: DocumentWithVersion[]) =>
  typed<EventFrontmatter>(items, safe(eventFrontmatterSchema));

/** "This week's": the newest within six days ahead (`currentQuestions` in shared). */
export function thisWeek(questions: Typed<QuestionsFrontmatter>[], today: string) {
  const picked = currentQuestions(
    questions.map((q) => ({ weekOf: q.frontmatter.weekOf, q })),
    today,
  );
  return picked?.q ?? null;
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

const long = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const weekdayOnly = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });

/** "Thursday, 5 November", the render's heading for a week. */
export function longDay(date: string): string {
  const parts = long.formatToParts(new Date(`${date}T00:00:00.000Z`));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')}, ${get('day')} ${get('month')}`;
}

/** "Thursday 5 November", the render's date line under a sign-up or a meeting. */
export function dayLine(date: string): string {
  return longDay(date).replace(',', '');
}

/** "6:30" from "18:30": the group's own clock, no zone, as the render shows it. */
export function clock(time: string): string {
  const [h = '0', m = '00'] = time.split(':');
  const hour = Number(h) % 12 || 12;
  return `${hour}:${m}`;
}

/** "Thursday 5 November, 6:30". */
export function whenLine(date: string, time?: string): string {
  return time ? `${dayLine(date)}, ${clock(time)}` : dayLine(date);
}

/**
 * "closes Thursday 5:00": the close in the viewer's own zone, named by its weekday when it
 * is within the week of the sheet, else by its date.
 */
export function closesLine(closesAt: string, date: string): string {
  const at = new Date(closesAt);
  const time = `${at.getHours() % 12 || 12}:${String(at.getMinutes()).padStart(2, '0')}`;
  const sameWeek = Math.abs(at.getTime() - new Date(`${date}T12:00:00`).getTime()) < 7 * 86_400_000;
  const day = sameWeek
    ? weekdayOnly.format(new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate())))
    : dayLine(
        `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`,
      );
  return `closes ${day} ${time}`;
}

/** "one", "up to 3": a slot's capacity as the render words it. */
export function capacityLine(capacity: number): string {
  return capacity === 1 ? 'one' : `up to ${capacity}`;
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
