/**
 * Every date the site shows, in one place. Each screen keeps the shape its render fixed
 * (the morning page says "Thursday, October 30"; the group says "Thursday, 5 November"),
 * so the formats are named for what they are, not for a locale; the choice of shape is a
 * design question (docs/DESIGN-VALUES.md), not one each route answers for itself.
 *
 * Calendar dates (`YYYY-MM-DD`) are formatted in UTC so the day never shifts; instants
 * (ISO timestamps) are formatted in the viewer's zone.
 */

const utc = { timeZone: 'UTC' } as const;
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);

/** Today as a calendar date in the viewer's own zone. */
export function todayIso(now = new Date()): string {
  return localIsoDate(now);
}

/** A local instant as the calendar date it falls on, `YYYY-MM-DD`. */
export function localIsoDate(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** The value a `datetime-local` input wants for an instant, in the viewer's zone. */
export function localDateTimeInput(iso?: string): string {
  if (!iso) return '';
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${localIsoDate(at)}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** The instant a `datetime-local` value names, or undefined for an empty field. */
export function fromDateTimeInput(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

/** "6:30" from "18:30", "12:15" from "00:15": a 12-hour clock with no meridiem, as the renders show it. */
export function clock12(hours: number, minutes: number): string {
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')}`;
}

/** "6:30" from an `HH:MM` string. */
export function clock(time: string): string {
  const [h = '0', m = '00'] = time.split(':');
  return clock12(Number(h), Number(m));
}

const instant = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
/** "Oct 26, 2026, 12:00 PM": when something happened. */
export const when = (iso: string) => instant.format(new Date(iso));

const mediumDay = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', ...utc });
/** "Nov 6, 2023": a calendar date, for `authoredAt` and the like. */
export const whenDay = (iso: string) => mediumDay.format(new Date(iso));

const monthYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', ...utc });
const monthYearLocal = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
/** "Nov 2025" for a calendar date; "Oct 2026" for an instant in the viewer's zone. */
export const monthOf = (iso: string, kind: 'date' | 'instant') =>
  (kind === 'date' ? monthYear : monthYearLocal).format(new Date(iso));

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...utc });
/** "14 Oct" for a calendar date in the current year, "14 Oct 2025" otherwise. */
export function shortDay(date: string, now = new Date()): string {
  const at = day(date);
  const text = dayMonth.format(at);
  return at.getUTCFullYear() === now.getFullYear() ? text : `${text} ${at.getUTCFullYear()}`;
}

const weekdayMonthDay = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  ...utc,
});
/** "Thursday, October 30": the morning page's way of naming a day. */
export const briefDay = (date: string) => weekdayMonthDay.format(day(date));

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', ...utc });
const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  ...utc,
});
/** "Saturday" and "31 October 2026": the morning page's heading. */
export function dayHeading(date: string): { weekday: string; date: string } {
  const at = day(date);
  return { weekday: weekday.format(at), date: dayMonthYear.format(at) };
}

const weekdayDayMonth = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  ...utc,
});
/** "Thursday, 5 November": the group's way of naming a day (docs/design/group-home-*.png). */
export function longDay(date: string): string {
  const parts = weekdayDayMonth.formatToParts(day(date));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')}, ${get('day')} ${get('month')}`;
}

/** "Thursday 5 November": the group's date line under a sign-up or a meeting. */
export const dayLine = (date: string) => longDay(date).replace(',', '');

/** "Thursday 5 November, 6:30". */
export const whenLine = (date: string, time?: string) =>
  time ? `${dayLine(date)}, ${clock(time)}` : dayLine(date);

/** The weekday of an instant, in the viewer's zone. */
const weekdayLocal = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

/**
 * "closes Thursday 5:00": a close in the viewer's own zone, named by its weekday when it
 * is within a week of the sheet's date, else by its date.
 */
export function closesLine(closesAt: string, date: string): string {
  const at = new Date(closesAt);
  const time = clock12(at.getHours(), at.getMinutes());
  const sameWeek = Math.abs(at.getTime() - new Date(`${date}T12:00:00`).getTime()) < 7 * 86_400_000;
  return `closes ${sameWeek ? weekdayLocal.format(at) : dayLine(localIsoDate(at))} ${time}`;
}

/** "written Nov 6, 2023 · entered Oct 26, 2026" when they differ, else the entry time alone. */
export function dates(version: { createdAt: string; authoredAt: string | null }): string {
  return version.authoredAt
    ? `written ${whenDay(version.authoredAt)} · entered ${when(version.createdAt)}`
    : when(version.createdAt);
}

/** "v4 · Tyler · written Nov 2025 · entered Oct 2026" (docs/DESIGN-VALUES.md "Screens"). */
export function versionLine(version: {
  number: number;
  author: { name: string };
  createdAt: string;
  authoredAt: string | null;
}): string {
  const written = version.authoredAt ? `written ${monthOf(version.authoredAt, 'date')} · ` : '';
  return `v${version.number} · ${version.author.name} · ${written}entered ${monthOf(version.createdAt, 'instant')}`;
}
