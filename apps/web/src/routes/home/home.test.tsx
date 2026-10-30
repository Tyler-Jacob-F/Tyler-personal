import { http, HttpResponse } from 'msw/http';
import { App } from '@/App';
import { briefDoc, recipeDoc, version2 } from '@/test/fixtures';
import { todayIso } from '@/routes/briefs/brief';
import { pickBrief } from '@/routes/home/home';
import { render, screen, userEvent, within } from '@/test/render';
import { server } from '@/test/server';

const today = todayIso();

function mockDocuments(briefs: unknown[], recent: unknown[]) {
  server.use(
    http.get('/api/documents', ({ request }) => {
      const type = new URL(request.url).searchParams.get('type');
      return HttpResponse.json({ items: type === 'brief' ? briefs : recent });
    }),
  );
}

describe('Home', () => {
  it("shows today's brief with its sections above recent documents of every type", async () => {
    const brief = briefDoc(today);
    mockDocuments([brief], [brief, recipeDoc(version2)]);
    render(<App />, { route: '/' });
    const briefRegion = await screen.findByRole('region', { name: "Today's brief" });
    expect(await within(briefRegion).findByText("Today's brief")).toBeInTheDocument();
    expect(within(briefRegion).getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(within(briefRegion).getByText('14:00 dentist')).toBeInTheDocument();
    expect(within(briefRegion).getByText(/brief-writer/)).toBeInTheDocument();
    expect(within(briefRegion).getByText('A quiet Thursday.')).toBeInTheDocument();

    const recent = screen.getByRole('region', { name: 'Recent documents' });
    const rows = await within(recent).findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole('link')).toHaveAttribute(
      'href',
      `/briefs/${brief.document.id}`,
    );
    expect(within(rows[1]!).getByRole('link')).toHaveAttribute(
      'href',
      `/recipes/${recipeDoc().document.id}`,
    );
    expect(within(rows[1]!).getByText('Recipe')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('falls back to the latest brief, saying so, when none is dated today', async () => {
    mockDocuments(
      [briefDoc('2026-10-28'), briefDoc('2026-10-29', '9c2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b')],
      [],
    );
    render(<App />, { route: '/' });
    const region = await screen.findByRole('region', { name: "Today's brief" });
    expect(
      await within(region).findByText(/Latest brief · none for today yet/),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole('heading', { name: 'Thursday, October 29' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
  });

  it('says where the brief comes from when there is none at all', async () => {
    mockDocuments([], []);
    render(<App />, { route: '/' });
    expect(await screen.findByText(/No brief yet/)).toBeInTheDocument();
  });

  it('opens a past brief on its own page from the recent list', async () => {
    const user = userEvent.setup();
    const brief = briefDoc('2026-10-29');
    mockDocuments([], [brief]);
    server.use(http.get(`/api/documents/${brief.document.id}`, () => HttpResponse.json(brief)));
    render(<App />, { route: '/' });
    await user.click(await screen.findByRole('link', { name: /Brief for 2026-10-29/ }));
    expect(
      await screen.findByRole('heading', { name: 'Thursday, October 29', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Brief')).toBeInTheDocument();
  });
});

describe('pickBrief', () => {
  it('prefers a brief dated today, else the newest by date, else nothing', () => {
    const a = briefDoc('2026-10-28');
    const b = briefDoc('2026-10-30', '9c2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b');
    expect(pickBrief([a, b], '2026-10-30')).toEqual({ item: b, isToday: true });
    expect(pickBrief([a, b], '2026-10-31')).toEqual({ item: b, isToday: false });
    expect(pickBrief([b, a], '2026-10-31')).toEqual({ item: b, isToday: false });
    expect(pickBrief([recipeDoc()], '2026-10-31')).toBeNull();
    expect(pickBrief([], '2026-10-31')).toBeNull();
  });
});
