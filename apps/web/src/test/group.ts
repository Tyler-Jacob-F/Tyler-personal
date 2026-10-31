import type { DocumentWithVersion, Member, SignupClaim } from '@the-keep/shared';
import { http, HttpResponse } from 'msw/http';
import { todayIso } from '@/routes/briefs/brief';
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
  questions: '7b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e41',
  signup: '7b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e42',
  event: '7b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e43',
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
  type: 'questions' | 'signup' | 'event',
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

/** Dated today so the home picks them whatever day the suite runs. */
export const today = todayIso();

export const questionsDoc = doc(
  gids.questions,
  'questions',
  'questions-for-thursday',
  { weekOf: today, title: `Questions for ${today}` },
  'We finished Luke 15 last week with the elder brother standing outside the party. This week stays there a while.\n\n1. Where in the story do you find yourself this week?\n2. The father runs. What does it cost him?\n3. The elder brother is never told whether he went in. Why?',
);

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
  closesAt: new Date(Date.now() + 86_400_000).toISOString(),
});

export const eventDoc = doc(gids.event, 'event', 'small-group', {
  title: 'Small group',
  date: today,
  time: '18:30',
  place: 'Tyler and Kelly’s · 12 Hanover Ave',
  notes: 'Kids welcome; the back room is set up. Park on Hanover, not the alley.',
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
  const docs = mocks.docs ?? [questionsDoc, signupDoc, eventDoc];
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
  );
}

/** A device holding a token, answered as the member Taylor or as a guest. */
export function mockDevice(who: 'member' | 'guest', mocks: GroupMocks = {}) {
  window.localStorage.setItem('keep.device', 'keepd_' + 'x'.repeat(43));
  server.use(http.get('/api/group/me', () => HttpResponse.json(groupMe[who])));
  mockGroup('/api/group', mocks);
}
