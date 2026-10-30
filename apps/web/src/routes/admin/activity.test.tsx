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
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('brief-writer')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Brief')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: 'Brief for 2026-10-30' })).toHaveAttribute(
      'href',
      '/briefs/6b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b',
    );
    expect(within(rows[1]!).getByText('importer')).toBeInTheDocument();
    expect(within(rows[1]!).getByRole('link', { name: 'Chili' })).toHaveAttribute(
      'href',
      `/recipes/${ids.doc}`,
    );
    expect(within(rows[1]!).getByText('v2')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/written Mar 3, 2014 · entered/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText('from the 2014 card')).toBeInTheDocument();
  });

  it('says so when no agent has written anything', async () => {
    server.use(http.get('/api/admin/activity', () => HttpResponse.json({ items: [] })));
    render(<App />, { route: '/admin/activity' });
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
  });
});
