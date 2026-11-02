import {
  DEFAULT_LITURGY,
  type DocumentWithVersion,
  type Member,
  type Passage,
  type SignupClaim,
} from '@the-keep/shared';
import { http, HttpResponse } from 'msw/http';
import { adminMe, server } from '@/test/server';

/** The render's sample group (docs/design/group-home-*.png), as the API would return it. */
export const gids = {
  tyler: adminMe.caller.id,
  kelly: '6b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e41',
  taylor: '6b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e42',
  john: '6b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e43',
  peter: '6b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e44',
  sarah: '6b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e45',
  hannah: '6b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e46',
  guide: '7b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e41',
  signup: '7b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e42',
  event: '7b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e43',
  liturgy: '7b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e44',
  friendsgiving: '7b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e45',
  device: '8b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e41',
};

const at = '2026-10-31T12:00:00.000Z';

function member(id: string, displayName: string, extra: Partial<Member> = {}): Member {
  return {
    id,
    displayName,
    role: 'group',
    email: null,
    phone: null,
    address: null,
    notes: null,
    claimedAt: null,
    createdAt: at,
    deviceCount: 0,
    ...extra,
  };
}

export const members: Member[] = [
  member(gids.tyler, 'Tyler and Kelly', {
    role: 'admin',
    email: 'tyler.fuqua@icloud.com',
    phone: '(804) 555-0142',
    address: '12 Hanover Ave, Richmond',
    notes: 'Hosts most weeks. Text, don’t call, after eight.',
    deviceCount: 2,
    claimedAt: at,
  }),
  member(gids.kelly, 'John and Anna', {
    role: 'colead',
    email: 'kelly@example.com',
    phone: '(804) 555-0177',
    address: 'Church Hill',
    deviceCount: 1,
    claimedAt: at,
  }),
  member(gids.taylor, 'Taylor', {
    phone: '(804) 555-0119',
    address: 'Museum District',
    deviceCount: 1,
    claimedAt: at,
  }),
  member(gids.peter, 'Peter', {
    phone: '(804) 555-0163',
    notes: 'Away the second week of November.',
  }),
  member(gids.sarah, 'Sarah and Will', { phone: '(804) 555-0188', address: 'Northside' }),
  member(gids.hannah, 'Hannah', { address: 'Carytown', notes: 'Gluten-free.' }),
];

const author = { kind: 'member' as const, id: gids.tyler, name: 'Tyler' };

function doc(
  id: string,
  type: 'guide' | 'liturgy' | 'signup' | 'event',
  slug: string,
  frontmatter: Record<string, unknown>,
  body = '',
): DocumentWithVersion {
  const versionId = id.replace(/^7/, '9');
  return {
    document: {
      id,
      type,
      slug,
      ring: 'group',
      owner: gids.tyler,
      createdAt: at,
      currentVersionId: versionId,
      tags: [],
      deletedAt: null,
    },
    version: {
      id: versionId,
      documentId: id,
      number: 1,
      body,
      frontmatter,
      author,
      createdAt: at,
      authoredAt: null,
      summary: '',
    },
  };
}

/**
 * The render's Thursday, 5 November 2026. The suite pins the clock to that day (see
 * `pinClock`), so the home picks these whatever day it runs and the hour can be chosen.
 */
export const today = '2026-11-05';
/** 3:00 in the afternoon in Richmond on the 5th: the sheet is open and the meeting is ahead. */
export const afternoon = new Date('2026-11-05T20:00:00.000Z');
/** 7:30 that evening: the meeting is on, so the page is the evening's. */
export const evening = new Date('2026-11-06T00:30:00.000Z');

/** Pin Date (and nothing else: timers stay real for Testing Library) to an instant. */
export function pinClock(at: Date) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at);
}

export const guideDoc = doc(gids.guide, 'guide', 'a-school-for-the-formation-of-the-saints', {
  title: 'A school for the formation of the saints',
  weekOf: today,
  series: 'Sanctuary',
  week: 4,
  opening: [
    { voice: 'leader', text: 'O God and Father of all, whom the whole heavens adore:' },
    {
      voice: 'people',
      text: 'Let the whole earth also worship you, all nations obey you, all tongues confess and bless you, and men, women, and children everywhere love you and serve you in peace.',
    },
  ],
  readings: ['Ephesians 1:15–23', 'Matthew 5:1–12'],
  reflection: 'The Church molds and shapes humans into the image of Christ.',
  questions: [
    'Look at the traits described in the Matthew passage. Who is a Christian you admire because their life reflects these traits of Jesus?',
    'What is the difference between going to church and being formed by church?',
    'God intends for us to grow as saints together rather than alone. How have you been a part of someone else’s formation at Redeemer?',
    'Look again at Matthew 5:1–12. Where do you see your own formation already taking hold?',
  ],
  closing: [
    {
      voice: 'leader',
      text: 'Glory to God whose power, working in us, can do infinitely more than we can ask or imagine.',
    },
    {
      voice: 'people',
      text: 'Glory to him from generation to generation in the Church, and in Christ Jesus for ever and ever. Amen.',
    },
    {
      voice: 'leader',
      text: 'Almighty God, you have given us grace at this time, with one accord to make our common supplications to you. Amen.',
    },
  ],
  source: 'Redeemer’s Sanctuary guide, week four · Fall 2026',
});

export const liturgyDoc = doc(gids.liturgy, 'liturgy', 'the-fixed-liturgy', { ...DEFAULT_LITURGY });

function verses(chapter: number, from: number, to: number, book: string) {
  return Array.from({ length: to - from + 1 }, (_, i) => ({
    chapter,
    verse: from + i,
    text: `${book} ${chapter}:${from + i} says a thing.`,
  }));
}

/** What `/passages` answers for the week's two readings, in the King James. */
export const passages: Record<string, Passage> = {
  'ephesians 1:15-23': {
    reference: 'Ephesians 1:15-23',
    translation: 'kjv',
    verses: verses(1, 15, 23, 'Ephesians'),
  },
  'matthew 5:1-12': {
    reference: 'Matthew 5:1-12',
    translation: 'kjv',
    verses: verses(5, 1, 12, 'Matthew'),
  },
};

export const signupDoc = doc(gids.signup, 'signup', 'dinner-at-tyler-and-kellys', {
  title: 'Dinner at Tyler and Kelly’s',
  date: today,
  slots: [
    { label: 'Main', capacity: 1 },
    { label: 'Salad', capacity: 1 },
    { label: 'Bread', capacity: 1 },
    { label: 'Dessert', capacity: 3 },
    { label: 'Drinks', capacity: 2 },
  ],
  closesAt: '2026-11-05T22:00:00.000Z',
});

/**
 * The calendar holds only the nights that differ from the standing meeting (which the
 * liturgy names): Friendsgiving, two Thursdays out, with its own sheet.
 */
export const eventDoc = doc(gids.event, 'event', 'friendsgiving', {
  title: 'Friendsgiving',
  date: '2026-11-19',
  time: '18:30',
  place: 'Tyler and Kelly’s · 12 Hanover Ave',
  notes: 'Entrées provided by the Fuquas; sides, drinks and desserts on the sign-up.',
});

export const friendsgivingSheet = doc(gids.friendsgiving, 'signup', 'friendsgiving', {
  title: 'Friendsgiving',
  date: '2026-11-19',
  slots: [
    { label: 'Sides', capacity: 4 },
    { label: 'Drinks', capacity: 2 },
    { label: 'Dessert', capacity: 3 },
  ],
});

function claim(id: string, slot: string, memberId: string, memberName: string): SignupClaim {
  return { id, documentId: gids.signup, slot, memberId, memberName, deviceId: null, createdAt: at };
}

export const claims: SignupClaim[] = [
  claim('ab2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e41', 'Main', gids.kelly, 'John'),
  claim('ab2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e42', 'Bread', gids.peter, 'Peter'),
  claim('ab2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e43', 'Dessert', gids.tyler, 'Kelly'),
  claim('ab2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e44', 'Dessert', gids.taylor, 'Taylor'),
  claim('ab2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e45', 'Drinks', gids.sarah, 'Sarah'),
];

export const groupMe = {
  member: {
    caller: { kind: 'group', deviceId: gids.device, memberId: gids.taylor, role: 'member' },
    email: null,
    displayName: 'Taylor',
  },
  guest: {
    caller: { kind: 'group', deviceId: gids.device, memberId: null, role: 'guest' },
    email: null,
    displayName: 'Guest',
  },
};

export const coleadMe = {
  caller: { kind: 'member', id: gids.kelly, role: 'colead' },
  email: 'kelly@example.com',
  displayName: 'John and Anna',
};

export interface GroupMocks {
  docs?: DocumentWithVersion[];
  members?: Member[];
  claims?: SignupClaim[];
}

/** The group's reads on one door: `/api` for a signed-in viewer, `/api/group` for a device. */
export function mockGroup(prefix: '/api' | '/api/group', mocks: GroupMocks = {}) {
  const docs = mocks.docs ?? [guideDoc, liturgyDoc, signupDoc, eventDoc, friendsgivingSheet];
  server.use(
    http.get(`${prefix}/documents`, ({ request }) => {
      const type = new URL(request.url).searchParams.get('type');
      return HttpResponse.json({ items: docs.filter((d) => !type || d.document.type === type) });
    }),
    http.get(`${prefix}/documents/:id`, ({ params }) => {
      const found = docs.find((d) => d.document.id === params.id);
      return found
        ? HttpResponse.json(found)
        : HttpResponse.json({ error: 'not_found', message: 'nope' }, { status: 404 });
    }),
    http.get(`${prefix}/documents/:id/claims`, () =>
      HttpResponse.json({ items: mocks.claims ?? claims }),
    ),
    http.get(`${prefix}/members`, () => HttpResponse.json({ items: mocks.members ?? members })),
    http.get(`${prefix}/passages`, ({ request }) => {
      const url = new URL(request.url);
      const key = (url.searchParams.get('ref') ?? '').replace(/[–—]/g, '-').toLowerCase();
      const found = passages[key];
      return found
        ? HttpResponse.json({ ...found, translation: url.searchParams.get('translation') ?? 'kjv' })
        : HttpResponse.json({ error: 'not_found', message: 'passage not found' }, { status: 404 });
    }),
  );
}

/** A device holding a token, answered as the member Taylor or as a guest. */
export function mockDevice(who: 'member' | 'guest', mocks: GroupMocks = {}) {
  window.localStorage.setItem('keep.device', 'keepd_' + 'x'.repeat(43));
  server.use(http.get('/api/group/me', () => HttpResponse.json(groupMe[who])));
  mockGroup('/api/group', mocks);
}
