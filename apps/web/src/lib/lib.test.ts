import { isActive, type Place } from '@/components/nav';
import {
  briefDay,
  clock,
  clock12,
  closesLine,
  dayHeading,
  dayLine,
  dates,
  fromDateTimeInput,
  localDateTimeInput,
  localIsoDate,
  longDay,
  shortDay,
  todayIso,
  versionLine,
  whenLine,
} from '@/lib/dates';
import { documentTypeInfo, pathFor, typeLabel } from '@/lib/document-types';
import { frontmatterOf, titleOf } from '@/lib/frontmatter';
import { anyError, anyPending } from '@/lib/queries';
import { z } from 'zod';

describe('dates', () => {
  it('names a calendar day the way each screen’s render does, without shifting the day', () => {
    expect(briefDay('2026-10-30')).toBe('Friday, October 30');
    expect(dayHeading('2026-10-31')).toEqual({ weekday: 'Saturday', date: '31 October 2026' });
    expect(longDay('2026-11-05')).toBe('Thursday, 5 November');
    expect(dayLine('2026-11-05')).toBe('Thursday 5 November');
    expect(whenLine('2026-11-05', '18:30')).toBe('Thursday 5 November, 6:30');
    expect(whenLine('2026-11-07')).toBe('Saturday 7 November');
    expect(shortDay('2026-10-14', new Date('2026-06-01'))).toBe('14 Oct');
    expect(shortDay('2025-10-14', new Date('2026-06-01'))).toBe('14 Oct 2025');
  });

  it('keeps one 12-hour clock', () => {
    expect(clock12(18, 30)).toBe('6:30');
    expect(clock12(0, 5)).toBe('12:05');
    expect(clock12(12, 0)).toBe('12:00');
    expect(clock('07:05')).toBe('7:05');
    const close = new Date(2026, 10, 5, 17, 0);
    expect(closesLine(close.toISOString(), '2026-11-05')).toBe('closes Thursday 5:00');
    const farOff = new Date(2026, 11, 24, 9, 30);
    expect(closesLine(farOff.toISOString(), '2026-11-05')).toBe('closes Thursday 24 December 9:30');
  });

  it('turns local instants into calendar dates and datetime-local values, and back', () => {
    const at = new Date(2026, 10, 5, 17, 0);
    expect(localIsoDate(at)).toBe('2026-11-05');
    expect(todayIso(at)).toBe('2026-11-05');
    expect(localDateTimeInput(at.toISOString())).toBe('2026-11-05T17:00');
    expect(localDateTimeInput(undefined)).toBe('');
    expect(fromDateTimeInput('2026-11-05T17:00')).toBe(at.toISOString());
    expect(fromDateTimeInput('')).toBeUndefined();
  });

  it('writes the version lines the recipe screens show', () => {
    const version = {
      number: 4,
      author: { name: 'Tyler' },
      createdAt: '2026-10-26T12:00:00.000Z',
      authoredAt: '2025-11-06T00:00:00.000Z',
    };
    expect(versionLine(version)).toMatch(/^v4 · Tyler · written Nov 2025 · entered Oct 2026$/);
    expect(dates(version)).toMatch(/^written Nov 6, 2023|^written Nov 6, 2025 · entered /);
    expect(dates({ ...version, authoredAt: null })).not.toMatch(/written/);
  });
});

describe('document types', () => {
  it('knows where every type lives, so Activity never links an event to a recipe', () => {
    expect(pathFor('recipe', 'r1')).toBe('/recipes/r1');
    expect(pathFor('brief', 'b1')).toBe('/briefs/b1');
    expect(pathFor('questions', 'q1')).toBe('/group/questions/q1');
    expect(pathFor('signup', 's1')).toBe('/group/signups/s1');
    expect(pathFor('event', 'e1')).toBe('/group/calendar');
    expect(pathFor('essay', 'x')).toBe('/');
    expect(typeLabel('signup')).toBe('Sign-up');
    expect(typeLabel('essay')).toBe('essay');
    expect(Object.keys(documentTypeInfo).sort()).toEqual([
      'brief',
      'event',
      'questions',
      'recipe',
      'signup',
    ]);
  });
});

describe('frontmatter', () => {
  it('parses to a type or to null, and titles fall back', () => {
    const of = frontmatterOf(z.object({ title: z.string() }));
    expect(of({ title: 'Chili' })).toEqual({ title: 'Chili' });
    expect(of({ nope: 1 })).toBeNull();
    expect(titleOf({ title: 'Chili' })).toBe('Chili');
    expect(titleOf({})).toBe('Untitled');
  });
});

describe('queries', () => {
  it('answers for a set of queries', () => {
    const ok = { isError: false, isPending: false, error: null };
    const pending = { ...ok, isPending: true };
    const failed = { ...ok, isError: true, error: new Error('x') };
    expect(anyPending([ok, pending])).toBe(true);
    expect(anyPending([ok])).toBe(false);
    expect(anyError([ok, failed])).toBe(true);
  });
});

describe('places', () => {
  it('lights an `end` place for its own path alone, and a prefix place for its paths', () => {
    const home: Place = { label: 'Home', to: '/group', matches: ['/group'], end: true };
    const members: Place = {
      label: 'Members',
      to: '/group/members',
      matches: ['/group/members', '/group/claim'],
    };
    expect(isActive(home, '/group')).toBe(true);
    expect(isActive(home, '/group/members')).toBe(false);
    expect(isActive(members, '/group/members/abc/edit')).toBe(true);
    expect(isActive(members, '/group/claim')).toBe(true);
    expect(isActive(members, '/group')).toBe(false);
    const root: Place = { label: 'Home', to: '/', matches: ['/', '/briefs'] };
    expect(isActive(root, '/')).toBe(true);
    expect(isActive(root, '/briefs/x')).toBe(true);
    expect(isActive(root, '/recipes')).toBe(false);
  });
});
