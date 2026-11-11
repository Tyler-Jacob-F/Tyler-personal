import type { SignupFrontmatter } from '@the-keep/shared';
import { http, HttpResponse } from 'msw/http';
import { App } from '@/App';
import { device } from '@/group/device';
import { rememberTranslation } from '@/lib/translation';
import { currentSignup, upcomingEvents } from '@/group/format';
import { clock, closesLine, inRichmond, longDay, whenLine } from '@/lib/dates';
import {
  afternoon,
  claims,
  coleadMe,
  evening,
  eventDoc,
  gids,
  guideDoc,
  liturgyDoc,
  members,
  mockDevice,
  mockGroup,
  pinClock,
  signupDoc,
  today,
} from '@/test/group';
import { render, screen, userEvent, waitFor, within } from '@/test/render';
import { server } from '@/test/server';

beforeEach(() => {
  window.localStorage.clear();
  pinClock(afternoon);
});
afterEach(() => vi.useRealTimers());

const slotRow = (sheet: HTMLElement, label: string) =>
  within(sheet)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(label) !== null)!;

describe('the group home for the admin', () => {
  it('reads top to bottom with the controls: Thursday and its sheet, the guide, the directory', async () => {
    mockGroup('/api');
    render(<App />, { route: '/group' });
    const page = await screen.findByRole('article', { name: 'Group' });
    const regions = within(page).getAllByRole('region', {
      name: /^(Thursday|Sanctuary · Week four|Members)$/,
    });
    expect(regions.map((r) => r.getAttribute('aria-labelledby'))).toEqual([
      'meeting-heading',
      'guide-heading',
      'members-heading',
    ]);

    // The coming Thursday at the standing time and place (from the liturgy), not the next
    // event: Friendsgiving is two weeks out and is named under "Coming up" with its sheet.
    const thursday = within(page).getByRole('region', { name: 'Thursday' });
    expect(
      within(thursday).getByRole('heading', { level: 3, name: '5 November, 6:30' }),
    ).toBeInTheDocument();
    const rows = within(thursday).getAllByRole('row');
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['Where']);
    expect(rows[0]).toHaveTextContent('Tyler and Kelly’s');
    expect(within(thursday).getByRole('link', { name: 'Add to calendar' })).toHaveAttribute(
      'download',
      'small-group-2026-11-05.ics',
    );
    expect(within(thursday).getByRole('link', { name: 'Add a meeting' })).toHaveAttribute(
      'href',
      '/group/calendar/new',
    );
    const later = within(thursday).getByRole('group', { name: 'Coming up' });
    expect(later).toHaveTextContent('Friendsgiving');
    expect(later).toHaveTextContent('Thursday 19 November, 6:30');
    expect(within(later).getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      `/group/signups/${gids.friendsgiving}`,
    );
    expect(within(thursday).getByRole('link', { name: 'Edit the sheet' })).toHaveAttribute(
      'href',
      `/group/signups/${gids.signup}/edit`,
    );
    // The sheet sits under the meeting, titled as the sheet is, with the close alone under it.
    expect(
      within(thursday).getByRole('heading', { name: 'Dinner at Tyler and Kelly’s' }),
    ).toBeInTheDocument();
    expect(within(thursday).getByText('Closes Thursday 5:00')).toBeInTheDocument();
    expect(within(thursday).queryByText(/Thursday 5 November/)).toBeNull();
    const slots = within(thursday).getByRole('list', { name: 'Slots' });
    expect(
      within(slots)
        .getAllByRole('listitem')
        .map((li) => li.querySelector('p')!.textContent),
    ).toEqual(['Main', 'Salad', 'Bread', 'Dessert', 'Drinks']);
    const main = slotRow(slots, 'Main');
    expect(within(main).getByText('one')).toBeInTheDocument();
    expect(within(main).getByText('John')).toBeInTheDocument();
    expect(within(main).getByText('Full')).toBeInTheDocument();
    const dessert = slotRow(slots, 'Dessert');
    expect(within(dessert).getByText('up to 3')).toBeInTheDocument();
    // The admin's own claim (Kelly, on Tyler's row) gets the one accent: Release.
    expect(within(dessert).getByRole('button', { name: 'Release Dessert' })).toHaveClass(
      'bg-accent',
    );
    expect(page.querySelectorAll('.bg-accent, .text-accent')).toHaveLength(1);
    // A co-lead or the admin puts names on slots and takes them off.
    expect(
      within(main).getByRole('button', { name: 'Release John from Main' }),
    ).toBeInTheDocument();
    expect(
      within(slotRow(slots, 'Salad')).getByRole('combobox', { name: 'Add a name to Salad' }),
    ).toBeInTheDocument();

    const guide = within(page).getByRole('region', { name: 'Sanctuary · Week four' });
    expect(within(guide).getByRole('heading', { level: 2 })).not.toHaveClass('text-accent');
    expect(
      within(guide).getByRole('heading', {
        level: 3,
        name: 'A school for the formation of the saints',
      }),
    ).toBeInTheDocument();
    expect(within(guide).getByText(/For whoever leads/)).toHaveClass('italic');
    expect(
      within(guide)
        .getAllByRole('region')
        .map((r) => r.getAttribute('aria-label')),
    ).toEqual([
      'Opening prayer',
      'Table',
      'Before the reading',
      'Scripture · Ephesians 1:15–23',
      'Scripture · Matthew 5:1–12',
      'Reflection',
      'Closing prayer',
    ]);
    expect(within(guide).getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/group/guide/${gids.guide}/edit`,
    );
    const table = within(guide).getByRole('region', { name: 'Table' });
    expect(
      within(table).getByText('Enjoy each other’s company with food and drink.'),
    ).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'The sheet is above' })).toHaveAttribute(
      'href',
      '/group#table',
    );

    const directory = within(page).getByRole('list', { name: 'Members' });
    const names = within(directory).getAllByRole('listitem');
    expect(names).toHaveLength(6);
    expect(names[0]).toHaveTextContent('Tyler and Kelly');
    expect(names[0]).toHaveTextContent('co-lead');
    expect(names[0]).toHaveTextContent('you');
    expect(within(names[0]!).getByRole('link', { name: 'Edit your details' })).toHaveAttribute(
      'href',
      `/group/members/${gids.tyler}/edit`,
    );
    expect(within(names[2]!).getByRole('link', { name: '(804) 555-0119' })).toHaveAttribute(
      'href',
      'tel:8045550119',
    );
    expect(within(names[3]!).getByText('Away the second week of November.')).toHaveClass('italic');
    expect(within(page).getByRole('link', { name: 'Add a member' })).toHaveAttribute(
      'href',
      '/group/members/new',
    );
    // Never: counts, badges, a greeting by name, urgency.
    expect(page.textContent).not.toMatch(/Good morning|overdue|urgent/i);
  });

  it('names the night by its event when the calendar has one for that Thursday', async () => {
    pinClock(evening);
    mockGroup('/api', {
      docs: [
        guideDoc,
        liturgyDoc,
        signupDoc,
        {
          ...eventDoc,
          version: {
            ...eventDoc.version,
            frontmatter: { ...eventDoc.version.frontmatter, date: today, place: 'The Bergs’' },
          },
        },
      ],
    });
    render(<App />, { route: '/group' });
    const page = await screen.findByRole('article', { name: 'Group' });
    const tonight = within(page).getByRole('region', { name: 'Tonight' });
    expect(tonight).toHaveTextContent('6:30 at The Bergs’ · Friendsgiving · members');
    expect(within(tonight).getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/group/calendar/${gids.event}/edit`,
    );
  });

  it('turns at 5:00 on meeting day: Tonight in a line, the guide first with its eyebrow brass, the sheet gone', async () => {
    pinClock(evening);
    mockGroup('/api');
    render(<App />, { route: '/group' });
    const page = await screen.findByRole('article', { name: 'Group' });
    const regions = within(page).getAllByRole('region', {
      name: /^(Tonight|Sanctuary · Week four|Members)$/,
    });
    expect(regions.map((r) => r.getAttribute('aria-labelledby'))).toEqual([
      'tonight-heading',
      'guide-heading',
      'members-heading',
    ]);
    const tonight = within(page).getByRole('region', { name: 'Tonight' });
    expect(tonight).toHaveTextContent('6:30 at Tyler and Kelly’s · members');
    expect(within(tonight).getByRole('link', { name: 'members' })).toHaveAttribute(
      'href',
      '/group/members',
    );
    expect(within(page).queryByRole('list', { name: 'Slots' })).toBeNull();
    const guide = within(page).getByRole('region', { name: 'Sanctuary · Week four' });
    expect(within(guide).getByRole('heading', { level: 2 })).toHaveClass('text-accent');
    expect(page.querySelectorAll('.bg-accent, .text-accent')).toHaveLength(1);
    const table = within(guide).getByRole('region', { name: 'Table' });
    expect(table).toHaveTextContent(
      'Main John · Salad — · Bread Peter · Dessert Kelly, Taylor · Drinks Sarah',
    );
    expect(within(table).queryByRole('link')).toBeNull();
  });

  it('reads the guide top to bottom: two voices, the collects with their Amen, three verses then the fold, the numbered questions, the fixed closing', async () => {
    const user = userEvent.setup();
    mockGroup('/api');
    render(<App />, { route: '/group' });
    const page = await screen.findByRole('article', { name: 'Group' });
    const guide = within(page).getByRole('region', { name: 'Sanctuary · Week four' });

    const opening = within(guide).getByRole('region', { name: 'Opening prayer' });
    const terms = within(opening).getAllByRole('term');
    expect(terms.map((t) => t.textContent)).toEqual(['Leader', 'People']);
    const people = within(opening).getAllByRole('definition')[1]!;
    expect(people).toHaveClass('font-semibold');
    expect(people).toHaveTextContent(/Let the whole earth also worship you/);

    const before = within(guide).getByRole('region', { name: 'Before the reading' });
    expect(before).toHaveTextContent(/Blessed Lord, who caused all Holy Scriptures/);
    expect(within(before).getByText('Amen.').tagName).toBe('STRONG');

    const ephesians = within(guide).getByRole('region', { name: 'Scripture · Ephesians 1:15–23' });
    expect(await within(ephesians).findByText(/Ephesians 1:17 says a thing/)).toBeInTheDocument();
    expect(ephesians).not.toHaveTextContent('Ephesians 1:18');
    const more = within(ephesians).getByRole('button', { name: 'Continue the reading · 6 verses' });
    await user.click(more);
    expect(ephesians).toHaveTextContent('Ephesians 1:23 says a thing');
    expect(within(ephesians).queryByRole('button')).toBeNull();
    const matthew = within(guide).getByRole('region', { name: 'Scripture · Matthew 5:1–12' });
    expect(
      await within(matthew).findByRole('button', { name: 'Continue the reading · 9 verses' }),
    ).toBeInTheDocument();

    const reflection = within(guide).getByRole('region', { name: 'Reflection' });
    expect(
      within(reflection).getByText('The Church molds and shapes humans into the image of Christ.'),
    ).toHaveClass('italic');
    expect(
      within(within(reflection).getByRole('list', { name: 'Questions' })).getAllByRole('listitem'),
    ).toHaveLength(4);

    const closing = within(guide).getByRole('region', { name: 'Closing prayer' });
    const voices = within(closing).getAllByRole('term');
    expect(voices.map((t) => t.textContent)).toEqual([
      'Leader',
      'People',
      'Leader',
      'People',
      'Leader',
    ]);
    expect(within(closing).getByText(/You may sing together from the Parish Songbook/)).toHaveClass(
      'italic',
    );
    const prayer = within(closing).getAllByRole('definition')[3]!;
    expect(prayer).toHaveClass('whitespace-pre-line');
    expect(prayer).toHaveTextContent(/Our Father, who art in heaven/);
    expect(within(closing).getAllByRole('definition')[4]).toHaveTextContent(
      /Lord Jesus Christ, you stretched out your arms/,
    );
    expect(guide).toHaveTextContent('From Redeemer’s Sanctuary guide, week four · Fall 2026');
  });

  it('shows what the week brings alone, with the way to set the liturgy, until the liturgy is saved', async () => {
    mockGroup('/api', { docs: [guideDoc, signupDoc] });
    render(<App />, { route: '/group/guide' });
    const page = await screen.findByRole('article', { name: 'Guide' });
    expect(
      within(page)
        .getAllByRole('region', { name: /./ })
        .map((r) => r.getAttribute('aria-label') ?? r.getAttribute('aria-labelledby')),
    ).toEqual([
      'guide-heading',
      'Opening prayer',
      'Table',
      'Scripture · Ephesians 1:15–23',
      'Scripture · Matthew 5:1–12',
      'Reflection',
      'Closing prayer',
      'other-weeks-heading',
      'liturgy-heading',
    ]);
    expect(within(page).getByText(/Not set yet/)).toBeInTheDocument();
    expect(within(page).getByRole('link', { name: 'Set it up' })).toHaveAttribute(
      'href',
      '/group/liturgy/edit',
    );
  });

  it('starts the liturgy from Redeemer’s words and saves it as one document', async () => {
    const user = userEvent.setup();
    mockGroup('/api', { docs: [guideDoc, signupDoc, eventDoc] });
    const posted: unknown[] = [];
    server.use(
      http.post('/api/documents', async ({ request }) => {
        posted.push(await request.json());
        return HttpResponse.json(liturgyDoc, { status: 201 });
      }),
    );
    render(<App />, { route: '/group/liturgy/edit' });
    const form = await screen.findByRole('article', { name: 'Liturgy form' });
    expect(within(form).getByRole('combobox', { name: 'Translation' })).toHaveValue('kjv');
    expect(within(form).getByRole('textbox', { name: 'Table' })).toHaveValue(
      'Enjoy each other’s company with food and drink.',
    );
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      type: 'liturgy',
      frontmatter: { translation: 'kjv', title: 'The fixed liturgy' },
    });
    expect(await screen.findByRole('article', { name: 'Guide' })).toBeInTheDocument();
  });

  it('enters a week from the seven fields, reading voices and lines out of the textareas', async () => {
    const user = userEvent.setup();
    mockGroup('/api');
    const posted: unknown[] = [];
    server.use(
      http.post('/api/documents', async ({ request }) => {
        posted.push(await request.json());
        return HttpResponse.json(guideDoc, { status: 201 });
      }),
    );
    render(<App />, { route: '/group/guide/new' });
    const form = await screen.findByRole('article', { name: 'Guide form' });
    expect(within(form).getByRole('textbox', { name: 'Series' })).toHaveValue('Sanctuary');
    await user.type(within(form).getByRole('textbox', { name: 'Week' }), '5');
    await user.type(within(form).getByLabelText('Thursday'), '2026-11-12');
    await user.type(within(form).getByRole('textbox', { name: 'Title' }), 'A people of the table');
    await user.type(
      within(form).getByRole('textbox', { name: 'Opening prayer' }),
      'Leader: O God.\n\nPeople: And also with you.',
    );
    await user.type(
      within(form).getByRole('textbox', { name: 'Readings' }),
      'Psalm 122\nJohn 6:35–59',
    );
    await user.type(within(form).getByRole('textbox', { name: 'Questions' }), '1. Why?\n2. How?');
    await user.type(within(form).getByRole('textbox', { name: 'Closing prayer' }), 'Amen alone.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(
      await within(form).findByText('Start each paragraph with "Leader:" or "People:".'),
    ).toBeInTheDocument();
    expect(posted).toHaveLength(0);
    await user.clear(within(form).getByRole('textbox', { name: 'Closing prayer' }));
    await user.type(
      within(form).getByRole('textbox', { name: 'Closing prayer' }),
      'Leader: Go in peace. Amen.',
    );
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0]).toMatchObject({
      type: 'guide',
      frontmatter: {
        title: 'A people of the table',
        weekOf: '2026-11-12',
        series: 'Sanctuary',
        week: 5,
        opening: [
          { voice: 'leader', text: 'O God.' },
          { voice: 'people', text: 'And also with you.' },
        ],
        readings: ['Psalm 122', 'John 6:35–59'],
        questions: ['Why?', 'How?'],
        closing: [{ voice: 'leader', text: 'Go in peace. Amen.' }],
      },
    });
  });

  it('shows the link panel on Members for the admin alone, and mints the link once', async () => {
    const user = userEvent.setup();
    mockGroup('/api');
    server.use(
      http.get('/api/admin/group-link', () => HttpResponse.json({ link: null, deviceCount: 0 })),
      http.post('/api/admin/group-link', async ({ request }) => {
        const body = (await request.json()) as { clearDevices: boolean };
        return HttpResponse.json(
          {
            link: {
              id: gids.device,
              createdBy: gids.tyler,
              createdAt: '2026-10-31T12:00:00.000Z',
              rotatedAt: null,
            },
            token: 'A'.repeat(43),
            url: `https://tylerfuqua.com/g/${'A'.repeat(43)}`,
            clearDevices: body.clearDevices,
          },
          { status: 201 },
        );
      }),
    );
    render(<App />, { route: '/group/members' });
    const panel = await screen.findByRole('region', { name: 'The group link' });
    expect(await within(panel).findByText(/No link yet/)).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Mint the link' }));
    expect(
      await within(panel).findByText(`https://tylerfuqua.com/g/${'A'.repeat(43)}`),
    ).toBeInTheDocument();
    // The lost-phone control lists the names phones hold.
    const phones = screen.getByRole('heading', { name: 'Phones' }).parentElement!;
    expect(within(phones).getAllByRole('button', { name: 'Clear' })).toHaveLength(3);
  });
});

describe('the group for a co-lead', () => {
  it('is the group’s own chrome with the controls and a sign-out, and the rest of the site redirects there', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json(coleadMe)));
    mockGroup('/api');
    render(<App />, { route: '/' });
    const page = await screen.findByRole('article', { name: 'Group' });
    expect(screen.queryByRole('navigation', { name: 'Places' })).toBeNull();
    const places = screen.getByRole('navigation', { name: 'Group places' });
    expect(
      within(places)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Home', 'Guide', 'Sign-up', 'Calendar', 'Members']);
    expect(within(places).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(within(page).getByRole('link', { name: 'Add a member' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'The group link' })).toBeNull();
  });
});

describe('the group for a phone that claimed a name', () => {
  it('shows the sheet with Taylor’s own action accented, takes a slot through the group door, and marks her row', async () => {
    const user = userEvent.setup();
    mockDevice('member');
    const posted: unknown[] = [];
    server.use(
      http.post('/api/group/documents/:id/claims', async ({ request }) => {
        posted.push(await request.json());
        return HttpResponse.json(
          {
            ...claims[0],
            id: 'ab2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e49',
            slot: 'Salad',
            memberId: gids.taylor,
            memberName: 'Taylor',
          },
          { status: 201 },
        );
      }),
    );
    render(<App />, { route: '/group', auth: { signedIn: false } });
    const page = await screen.findByRole('article', { name: 'Group' });
    expect(screen.getByRole('navigation', { name: 'Group places' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(within(page).queryByRole('link', { name: 'Edit' })).toBeNull();
    // No co-lead control; the translation select is every reader's.
    expect(within(page).queryByRole('combobox', { name: /Add a name/ })).toBeNull();

    const slots = within(page).getByRole('list', { name: 'Slots' });
    const dessert = slotRow(slots, 'Dessert');
    expect(within(dessert).getByText('Taylor').parentElement).toHaveClass('font-semibold');
    expect(within(dessert).getByRole('button', { name: 'Release Dessert' })).toHaveClass(
      'bg-accent',
    );
    expect(page.querySelectorAll('.bg-accent, .text-accent')).toHaveLength(1);
    expect(within(slotRow(slots, 'Main')).getByText('Full')).toBeInTheDocument();
    expect(within(slotRow(slots, 'Main')).queryByRole('button')).toBeNull();

    await user.click(within(slotRow(slots, 'Salad')).getByRole('button', { name: 'Take Salad' }));
    await waitFor(() => expect(posted).toEqual([{ slot: 'Salad' }]));

    const names = within(page)
      .getAllByRole('listitem')
      .filter((li) => /Taylor/.test(li.textContent ?? ''));
    const own = names.find((li) => within(li).queryByText('you'))!;
    expect(within(own).getByRole('link', { name: 'Edit your details' })).toHaveAttribute(
      'href',
      `/group/members/${gids.taylor}/edit`,
    );
  });

  it('at 7:30 on the night reads the guide first, with nothing to take', async () => {
    pinClock(evening);
    mockDevice('member');
    render(<App />, { route: '/group', auth: { signedIn: false } });
    const page = await screen.findByRole('article', { name: 'Group' });
    expect(within(page).getByRole('region', { name: 'Tonight' })).toBeInTheDocument();
    expect(within(page).queryByRole('list', { name: 'Slots' })).toBeNull();
    expect(within(page).queryByRole('button', { name: /Release|Take/ })).toBeNull();
    expect(page.querySelectorAll('.bg-accent, .text-accent')).toHaveLength(1);
    expect(
      within(page).getByRole('heading', { level: 2, name: 'Sanctuary · Week four' }),
    ).toHaveClass('text-accent');
  });

  it('edits only its own details, through the group door', async () => {
    const user = userEvent.setup();
    mockDevice('member');
    const patched: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.patch('/api/group/members/:id', async ({ params, request }) => {
        patched.push({ id: String(params.id), body: await request.json() });
        return HttpResponse.json(members[2]);
      }),
    );
    render(<App />, { route: `/group/members/${gids.taylor}/edit`, auth: { signedIn: false } });
    const form = await screen.findByRole('article', { name: 'Member form' });
    expect(within(form).getByRole('heading', { name: 'Your details' })).toBeInTheDocument();
    expect(within(form).queryByText('Co-leads only')).toBeNull();
    const name = within(form).getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('Taylor');
    await user.clear(name);
    await user.type(name, 'Taylor Thomas');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(patched).toEqual([
        {
          id: gids.taylor,
          body: {
            displayName: 'Taylor Thomas',
            phone: '(804) 555-0119',
            address: 'Museum District',
            notes: null,
          },
        },
      ]),
    );
    expect(await screen.findByRole('article', { name: 'Members' })).toBeInTheDocument();
  });

  it('is sent back to the link when the group no longer knows the phone', async () => {
    mockDevice('member');
    server.use(
      http.get('/api/group/me', () => HttpResponse.json({ message: 'Forbidden' }, { status: 403 })),
    );
    render(<App />, { route: '/group', auth: { signedIn: false } });
    expect(await screen.findByText('This phone is no longer in the group.')).toBeInTheDocument();
    expect(device.load()).toBeNull();
  });
});

describe('the group for a phone that has not claimed a name', () => {
  it('reads the sheet and is pointed at the claim screen, where one tap takes a free name', async () => {
    const user = userEvent.setup();
    mockDevice('guest');
    const claimed: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.post('/api/group/members/:id/claim', async ({ params, request }) => {
        claimed.push({ id: String(params.id), body: await request.json() });
        return HttpResponse.json({ ...members[3], deviceCount: 1 });
      }),
    );
    render(<App />, { route: '/group', auth: { signedIn: false } });
    const page = await screen.findByRole('article', { name: 'Group' });
    // The sentence under the title carries the one accent; the slots repeat it as outline buttons.
    const first = within(page).getAllByRole('link', { name: 'Tap your name first' })[0]!;
    expect(first).toHaveClass('text-accent');
    expect(first).toHaveAttribute('href', '/group/claim');
    expect(page.querySelectorAll('.bg-accent, .text-accent')).toHaveLength(1);
    const slots = within(page).getByRole('list', { name: 'Slots' });
    expect(
      within(slotRow(slots, 'Salad')).getByRole('link', { name: 'Tap your name first' }),
    ).toBeInTheDocument();
    expect(within(slotRow(slots, 'Main')).getByText('Full')).toBeInTheDocument();

    await user.click(first);
    const claim = await screen.findByRole('article', { name: 'Who are you?' });
    expect(within(claim).getByText('One tap. This phone will remember.')).toBeInTheDocument();
    expect(within(claim).getByRole('link', { name: 'Just look for now' })).toHaveAttribute(
      'href',
      '/group',
    );
    const free = within(claim).getByRole('list', { name: 'Names' });
    expect(
      within(free)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Peter', 'Sarah and Will', 'Hannah']);
    const taken = within(claim).getByRole('list', { name: 'Claimed names' });
    expect(
      within(taken)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Tyler and Kellytwo phones', 'John and Annaa phone', 'Taylora phone']);

    await user.click(within(free).getByRole('button', { name: 'Peter' }));
    await waitFor(() => expect(claimed).toEqual([{ id: gids.peter, body: { confirm: false } }]));
    expect(await screen.findByRole('article', { name: 'Group' })).toBeInTheDocument();
  });

  it('asks once before taking a name that is already on another device', async () => {
    const user = userEvent.setup();
    mockDevice('guest');
    const claimed: Array<{ id: string; body: unknown }> = [];
    server.use(
      http.post('/api/group/members/:id/claim', async ({ params, request }) => {
        const body = (await request.json()) as { confirm: boolean };
        claimed.push({ id: String(params.id), body });
        if (!body.confirm)
          return HttpResponse.json(
            { error: 'already_claimed', message: 'Taylor is already on another device' },
            { status: 409 },
          );
        return HttpResponse.json({ ...members[2], deviceCount: 2 });
      }),
    );
    render(<App />, { route: '/group/claim', auth: { signedIn: false } });
    const claim = await screen.findByRole('article', { name: 'Who are you?' });
    await user.click(within(claim).getByRole('button', { name: /^Taylor/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('You are Taylor, and this phone should be yours too?');
    expect(dialog).toHaveTextContent('The other device stays signed in.');
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(within(claim).getByRole('button', { name: /^Taylor/ }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, it is me' }),
    );
    await waitFor(() => expect(claimed).toEqual([{ id: gids.taylor, body: { confirm: true } }]));
    expect(await screen.findByRole('article', { name: 'Group' })).toBeInTheDocument();
  });
});

describe('the link landing', () => {
  const token = 'B'.repeat(43);

  it('turns the link into a device token, kept on the phone, and continues to the group', async () => {
    const entered: unknown[] = [];
    server.use(
      http.post('/api/group/enter', async ({ request }) => {
        entered.push(await request.json());
        return HttpResponse.json(
          {
            deviceToken: `keepd_${'C'.repeat(43)}`,
            device: {
              id: gids.device,
              memberId: null,
              createdAt: '2026-10-31T12:00:00.000Z',
              lastSeenAt: '2026-10-31T12:00:00.000Z',
              clearedAt: null,
            },
          },
          { status: 201 },
        );
      }),
    );
    render(<App />, { route: `/g/${token}`, auth: { signedIn: false } });
    expect(await screen.findByText('You’re in the group.')).toBeInTheDocument();
    expect(entered).toEqual([{ token }]);
    expect(device.load()).toBe(`keepd_${'C'.repeat(43)}`);
    // A phone with no name yet continues to "Who are you?"; the home is a tap away from there.
    const go = screen.getByRole('link', { name: 'Continue' });
    expect(go).toHaveAttribute('href', '/group/claim');
    expect(go).toHaveClass('bg-accent');
  });

  it('says so when the link is no longer the group’s, and keeps a phone that is already in', async () => {
    server.use(
      http.post('/api/group/enter', () =>
        HttpResponse.json({ error: 'not_found', message: 'group link not found' }, { status: 404 }),
      ),
    );
    render(<App />, { route: `/g/${token}`, auth: { signedIn: false } });
    expect(await screen.findByText('This link is no longer the group’s.')).toBeInTheDocument();
    expect(screen.getByText('Ask Tyler or a co-lead for the current one.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Continue' })).toBeNull();
  });

  it('lets a phone that already holds a live token straight through without a second device, to the home once it has a name', async () => {
    mockDevice('member');
    let entered = 0;
    server.use(
      http.post('/api/group/enter', () => {
        entered += 1;
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    render(<App />, { route: `/g/${token}`, auth: { signedIn: false } });
    expect(await screen.findByText('You’re in the group.')).toBeInTheDocument();
    expect(entered).toBe(0);
    expect(screen.getByRole('link', { name: 'Continue' })).toHaveAttribute('href', '/group');
  });

  it('asks for the link when a phone has none, with the way in for a co-lead', async () => {
    render(<App />, { route: '/group', auth: { signedIn: false } });
    expect(await screen.findByText('You need the group link.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Co-lead? Sign in' })).toHaveAttribute(
      'href',
      '/group/sign-in',
    );
  });

  it('signs a co-lead in through the group client and lands on the group', async () => {
    const user = userEvent.setup();
    const requestCode = vi.fn(async (email: string, client?: string) => ({
      email,
      username: 'u',
      session: 's',
      client: client as 'group',
    }));
    render(<App />, { route: '/group/sign-in', auth: { signedIn: false, requestCode } });
    expect(await screen.findByRole('heading', { name: 'Co-lead sign in' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'kelly@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(requestCode).toHaveBeenCalledWith('kelly@example.com', 'group'));
  });
});

describe('the group’s dates and picks', () => {
  it('words the render’s lines', () => {
    expect(longDay('2026-11-05')).toBe('Thursday, 5 November');
    expect(clock('18:30')).toBe('6:30');
    expect(clock('00:15')).toBe('12:15');
    expect(whenLine('2026-11-05', '18:30')).toBe('Thursday 5 November, 6:30');
    expect(whenLine('2026-11-07')).toBe('Saturday 7 November');
    expect(closesLine('2026-11-05T22:00:00.000Z', '2026-11-05')).toBe('closes Thursday 5:00');
    expect(closesLine('2026-12-25T22:00:00.000Z', '2026-11-05')).toBe(
      'closes Friday 25 December 5:00',
    );
    expect(inRichmond(afternoon)).toEqual({ date: '2026-11-05', hour: 15, minute: 0 });
    expect(inRichmond(evening)).toEqual({ date: '2026-11-05', hour: 19, minute: 30 });
    // Standard time: midnight in Richmond is five hours behind UTC.
    expect(inRichmond(new Date('2026-11-06T04:59:00Z')).date).toBe('2026-11-05');
    expect(inRichmond(new Date('2026-11-06T05:00:00Z'))).toEqual({
      date: '2026-11-06',
      hour: 0,
      minute: 0,
    });
  });

  it('picks the coming Thursday’s sheet and the next meeting, never a past one', () => {
    const sheet = {
      item: signupDoc,
      frontmatter: signupDoc.version.frontmatter as unknown as SignupFrontmatter,
    };
    const past = { ...sheet, frontmatter: { ...sheet.frontmatter, date: '2026-01-01' } };
    const later = { ...sheet, frontmatter: { ...sheet.frontmatter, date: '2099-01-01' } };
    expect(currentSignup([later, past, sheet], today)).toBe(sheet);
    expect(currentSignup([past], today)).toBeNull();
    expect(
      upcomingEvents([later, past, sheet] as never, today).map((e) => e.frontmatter.date),
    ).toEqual([today, '2099-01-01']);
  });
});

describe('the readings’ translation', () => {
  it('opens in the liturgy’s, follows the select, remembers the choice, and credits a licensed text', async () => {
    const user = userEvent.setup();
    const asked: string[] = [];
    mockGroup('/api');
    server.use(
      http.get('/api/passages', ({ request }) => {
        const url = new URL(request.url);
        const translation = url.searchParams.get('translation') ?? 'kjv';
        asked.push(translation);
        return HttpResponse.json({
          reference: url.searchParams.get('ref'),
          translation,
          verses: [{ chapter: 1, verse: 1, text: `A verse in the ${translation}.` }],
          ...(translation === 'esv'
            ? { attribution: { text: 'ESV', url: 'https://www.esv.org' } }
            : {}),
        });
      }),
    );
    render(<App />, { route: '/group/guide' });
    const page = await screen.findByRole('article', { name: 'Guide' });
    const select = within(page).getByRole('combobox', { name: 'Translation' });
    expect(select).toHaveValue('kjv');
    await waitFor(() => expect(within(page).getAllByText('A verse in the kjv.')).toHaveLength(2));
    expect(within(page).queryByRole('link', { name: 'ESV' })).toBeNull();

    await user.selectOptions(select, 'esv');
    await waitFor(() => expect(within(page).getAllByText('A verse in the esv.')).toHaveLength(2));
    expect(within(page).getAllByRole('link', { name: 'ESV' })[0]).toHaveAttribute(
      'href',
      'https://www.esv.org',
    );
    expect(asked.filter((t) => t === 'esv')).toHaveLength(2);
    expect(window.localStorage.getItem('keep.translation')).toBe('esv');
  });

  it('spins the wheel to a translation the week decides, the same on every phone', async () => {
    const user = userEvent.setup();
    mockDevice('member');
    render(<App />, { route: '/group/guide', auth: { signedIn: false } });
    const page = await screen.findByRole('article', { name: 'Guide' });
    const select = within(page).getByRole('combobox', { name: 'Translation' });
    expect(select).toHaveValue('kjv');
    await user.click(within(page).getByRole('button', { name: 'Spin the wheel' }));
    const spun = (select as HTMLSelectElement).value;
    expect(spun).not.toBe('kjv');
    expect(window.localStorage.getItem('keep.translation')).toBe(spun);
    // A second phone, starting where the first did, lands on the same one.
    window.localStorage.removeItem('keep.translation');
    rememberTranslation(null);
    await user.click(within(page).getByRole('button', { name: 'Spin the wheel' }));
    expect(select).toHaveValue(spun);
  });

  it('says when a reading came from the Douay-Rheims because the translation asked has no such book, and when a translation is not set up', async () => {
    mockGroup('/api', {
      docs: [
        {
          ...guideDoc,
          version: {
            ...guideDoc.version,
            frontmatter: {
              ...guideDoc.version.frontmatter,
              readings: ['Ecclesiasticus 44:1–15', 'Matthew 5:1–12'],
            },
          },
        },
        liturgyDoc,
        signupDoc,
        eventDoc,
      ],
    });
    window.localStorage.setItem('keep.translation', 'niv');
    server.use(
      http.get('/api/passages', ({ request }) => {
        const url = new URL(request.url);
        const ref = url.searchParams.get('ref') ?? '';
        if (/Ecclesiasticus/.test(ref)) {
          return HttpResponse.json({
            reference: 'Ecclesiasticus 44:1-15',
            translation: 'dra',
            verses: [{ chapter: 44, verse: 1, text: 'Let us now praise men of renown.' }],
          });
        }
        return HttpResponse.json(
          { error: 'translation_unavailable', message: 'the NIV is not set up yet' },
          { status: 503 },
        );
      }),
    );
    render(<App />, { route: '/group/guide' });
    const page = await screen.findByRole('article', { name: 'Guide' });
    const sirach = within(page).getByRole('region', { name: 'Scripture · Ecclesiasticus 44:1–15' });
    expect(await within(sirach).findByText(/Let us now praise/)).toBeInTheDocument();
    expect(sirach).toHaveTextContent('From the Douay-Rheims; the NIV has no Ecclesiasticus.');
    const matthew = within(page).getByRole('region', { name: 'Scripture · Matthew 5:1–12' });
    expect(await within(matthew).findByText('The NIV is not set up yet.')).toBeInTheDocument();
  });
});
