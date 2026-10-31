import type { SignupFrontmatter } from '@the-keep/shared';
import { http, HttpResponse } from 'msw/http';
import { App } from '@/App';
import { device } from '@/group/device';
import { currentSignup, upcomingEvents } from '@/group/format';
import { clock, closesLine, longDay, whenLine } from '@/lib/dates';
import {
  claims,
  coleadMe,
  gids,
  members,
  mockDevice,
  mockGroup,
  signupDoc,
  today,
} from '@/test/group';
import { render, screen, userEvent, waitFor, within } from '@/test/render';
import { server } from '@/test/server';

beforeEach(() => window.localStorage.clear());

const slotRow = (sheet: HTMLElement, label: string) =>
  within(sheet)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(label) !== null)!;

describe('the group home for the admin', () => {
  it('reads top to bottom with the controls: this week, the sign-up, the next meeting, the directory', async () => {
    mockGroup('/api');
    render(<App />, { route: '/group' });
    const page = await screen.findByRole('article', { name: 'Group' });

    const week = within(page).getByRole('region', { name: 'This week' });
    expect(within(week).getByRole('heading', { level: 1 })).toHaveTextContent(longDay(today));
    expect(within(week).getByText(/elder brother standing outside/)).toBeInTheDocument();
    expect(within(week).getAllByRole('listitem')).toHaveLength(3);
    expect(within(week).getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/group/questions/${gids.questions}/edit`,
    );

    const signup = within(page).getByRole('region', { name: 'Sign-up' });
    expect(
      within(signup).getByRole('heading', { name: 'Dinner at Tyler and Kelly’s' }),
    ).toBeInTheDocument();
    const slots = within(signup).getByRole('list', { name: 'Slots' });
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

    const meeting = within(page).getByRole('region', { name: 'Next meeting' });
    const rows = within(meeting).getAllByRole('row');
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      'When',
      'Where',
      'Notes',
    ]);
    expect(rows[0]).toHaveTextContent(`${whenLine(today, '18:30')}`);
    expect(within(meeting).getByRole('link', { name: 'Add to calendar' })).toHaveAttribute(
      'download',
      'small-group.ics',
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
    ).toEqual(['Home', 'Questions', 'Sign-up', 'Calendar', 'Members']);
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
    expect(within(page).queryByRole('combobox')).toBeNull();

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
    const close = new Date(2026, 10, 5, 17, 0).toISOString();
    expect(closesLine(close, '2026-11-05')).toBe('closes Thursday 5:00');
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
