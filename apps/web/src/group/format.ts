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

export const questionsOf = (items: DocumentWithVersion[]) =>
  typed<QuestionsFrontmatter>(items, frontmatterOf(questionsFrontmatterSchema));
export const signupsOf = (items: DocumentWithVersion[]) =>
  typed<SignupFrontmatter>(items, frontmatterOf(signupFrontmatterSchema));
export const eventsOf = (items: DocumentWithVersion[]) =>
  typed<EventFrontmatter>(items, frontmatterOf(eventFrontmatterSchema));

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
