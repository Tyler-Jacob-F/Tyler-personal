import { http, HttpResponse } from 'msw/http';
import { App } from '@/App';
import { activity, ids } from '@/test/fixtures';
import { render, screen, within } from '@/test/render';
import { server } from '@/test/server';

describe('ActivityPage', () => {
  it('lists what agents wrote, newest first, with the token name, type, title and dates', async () => {
    server.use(
      http.get('/api/admin/activity', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('days')).toBe('30');
        return HttpResponse.json({ items: activity });
      }),
    );
    render(<App />, { route: '/admin/activity' });
    expect(screen.getByRole('link', { name: 'Activity' })).toHaveAttribute(
      'href',
      '/admin/activity',
    );
    expect(
      await screen.findByRole('heading', { name: 'Agent activity', level: 1 }),
    ).toBeInTheDocument();
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('claude')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('tagged')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: 'Chili' })).toHaveAttribute(
      'href',
      `/recipes/${ids.doc}`,
    );
    expect(within(rows[0]!).getByText('Beef')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Cookoff')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('brief-writer')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Brief')).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('link', { name: 'Brief for 2026-10-30' })).toHaveAttribute(
      'href',
      '/briefs/6b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
    );
    expect(within(rows[2]!).getByText('importer')).toBeInTheDocument();
    expect(within(rows[2]!).getByRole('link', { name: 'Chili' })).toHaveAttribute(
      'href',
      `/recipes/${ids.doc}`,
    );
    expect(within(rows[2]!).getByText('v2')).toBeInTheDocument();
    expect(within(rows[2]!).getByText(/written Mar 3, 2014 · entered/)).toBeInTheDocument();
    expect(within(rows[2]!).getByText('from the 2014 card')).toBeInTheDocument();
  });

  it('links the group’s types to the group, not to a recipe', async () => {
    const event = {
      kind: 'version',
      versionId: '9c2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4c',
      documentId: '7c2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4c',
      documentType: 'event',
      slug: 'small-group',
      title: 'Small group',
      token: { id: '4b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b', name: 'claude' },
      createdAt: '2026-10-31T12:00:00.000Z',
      number: 1,
      summary: 'next Thursday',
      authoredAt: null,
    };
    server.use(http.get('/api/admin/activity', () => HttpResponse.json({ items: [event] })));
    render(<App />, { route: '/admin/activity' });
    const row = (await screen.findAllByRole('listitem'))[0]!;
    expect(within(row).getByText('Event')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Small group' })).toHaveAttribute(
      'href',
      '/group/calendar',
    );
  });

  it('says so when no agent has written anything', async () => {
    server.use(http.get('/api/admin/activity', () => HttpResponse.json({ items: [] })));
    render(<App />, { route: '/admin/activity' });
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
  });
});
