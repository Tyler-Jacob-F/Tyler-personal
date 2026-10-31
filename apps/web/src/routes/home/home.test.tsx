import { http, HttpResponse } from 'msw/http';
import { App } from '@/App';
import { briefDoc, recipeDoc } from '@/test/fixtures';
import { dayHeading, todayIso } from '@/lib/dates';
import { pickBrief } from '@/routes/home/home';
import { blocksOf, morningParts, parseShapeRow } from '@/routes/home/morning';
import { render, screen, within } from '@/test/render';
import { server } from '@/test/server';

const today = todayIso();

function mockBriefs(briefs: unknown[]) {
  server.use(http.get('/api/documents', () => HttpResponse.json({ items: briefs })));
}

describe('the morning page', () => {
  it('reads top to bottom: the day, the Office with the one accent, at most three items, the day’s shape', async () => {
    mockBriefs([briefDoc(today)]);
    render(<App />, { route: '/' });
    const page = await screen.findByRole('article', { name: 'Morning' });
    const { weekday, date } = dayHeading(today);
    expect(within(page).getByText(weekday)).toBeInTheDocument();
    expect(within(page).getByRole('heading', { name: date, level: 1 })).toBeInTheDocument();
    expect(within(page).getByText(/Season after Pentecost · Sunrise 7:35/)).toBeInTheDocument();

    const office = within(page).getByRole('region', { name: 'Morning Prayer' });
    expect(within(office).getByRole('heading', { name: 'Morning Prayer' })).toHaveClass(
      'text-accent',
    );
    expect(
      within(office).getByRole('heading', { name: 'Venite · Psalm 95', level: 4 }),
    ).toHaveClass('eyebrow');
    expect(within(office).getByText('O come, let us sing unto the Lord.')).toBeInTheDocument();
    // The accent appears exactly once on the page.
    expect(page.querySelectorAll('.text-accent, .bg-accent, .border-accent')).toHaveLength(1);

    const brief = within(page).getByRole('region', { name: 'The brief' });
    const items = within(brief).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Eleven days left at Roundtrip.',
      'Jimmy’s costume still needs a belt.',
      'Small group is at ours Thursday.',
    ]);
    expect(screen.queryByText(/fourth item/)).toBeNull();
    expect(screen.queryByText(/Two emails/)).toBeNull();

    const shape = within(page).getByRole('region', { name: 'Today' });
    const rows = within(shape).getAllByRole('row');
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      '9:00',
      '14:00',
      'Dinner',
    ]);
    expect(within(rows[2]!).getByRole('link', { name: 'Chili' })).toHaveAttribute(
      'href',
      `/recipes/${recipeDoc().document.id}`,
    );
    expect(within(page).getByText(/brief-writer/)).toBeInTheDocument();
    // Never: a greeting by name, counts, urgency.
    expect(page.textContent).not.toMatch(/Good morning|Tyler,|overdue|urgent/i);
  });

  it('shows the latest brief, saying whose morning it was, when today’s is not in yet', async () => {
    mockBriefs([
      briefDoc('2026-10-28'),
      briefDoc('2026-10-29', '9c2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b'),
    ]);
    render(<App />, { route: '/' });
    const page = await screen.findByRole('article', { name: 'Morning' });
    expect(
      within(page).getByRole('heading', { name: dayHeading(today).date, level: 1 }),
    ).toBeInTheDocument();
    expect(
      within(page).getByText(/Today’s brief is not in yet; this is Thursday, October 29’s\./),
    ).toBeInTheDocument();
    expect(within(page).getByRole('region', { name: 'Morning Prayer' })).toBeInTheDocument();
  });

  it('is still the morning page on a day with no brief: the date, one quiet line, nothing else', async () => {
    mockBriefs([]);
    render(<App />, { route: '/' });
    const page = await screen.findByRole('article', { name: 'Morning' });
    expect(within(page).getByRole('heading', { level: 1 })).toHaveTextContent(
      dayHeading(today).date,
    );
    expect(within(page).getByText('No brief this morning.')).toBeInTheDocument();
    expect(within(page).queryByRole('region')).toBeNull();
    expect(page.querySelectorAll('.text-accent')).toHaveLength(0);
  });

  it('lays a past brief out as the morning it was', async () => {
    const brief = briefDoc('2026-10-29');
    server.use(http.get(`/api/documents/${brief.document.id}`, () => HttpResponse.json(brief)));
    render(<App />, { route: `/briefs/${brief.document.id}` });
    const page = await screen.findByRole('article', { name: 'Morning' });
    expect(within(page).getByText('Thursday')).toBeInTheDocument();
    expect(
      within(page).getByRole('heading', { name: '29 October 2026', level: 1 }),
    ).toBeInTheDocument();
  });
});

describe('morningParts', () => {
  it('maps sections by heading, folds the rest into the brief, and caps it at three', () => {
    const parts = morningParts({
      title: 'x',
      date: '2026-10-31',
      sections: [
        { heading: 'Waiting on you', body: 'A\n\nB' },
        { heading: 'The Day', body: 'All Hallows’ Eve · 52° and clear' },
        { heading: 'Morning Prayer', body: 'O Lord, open thou our lips;' },
        { heading: 'The brief', body: 'One.\n\nTwo.' },
        { heading: "The day's shape", body: '- 9:00 Pancakes\n- Thu · Small group at ours' },
      ],
    });
    expect(parts.day).toBe('All Hallows’ Eve · 52° and clear');
    expect(parts.office).toBe('O Lord, open thou our lips;');
    expect(parts.items).toEqual(['One.', 'Two.', 'A']);
    expect(parts.shape).toEqual([
      { label: '9:00', text: 'Pancakes' },
      { label: 'Thu', text: 'Small group at ours' },
    ]);
    expect(parts.officeTitle).toBe('Morning Prayer');
    expect(morningParts(null)).toEqual({
      day: null,
      office: null,
      officeTitle: 'Morning Prayer',
      items: [],
      shape: [],
    });
  });

  it('lets the office eyebrow follow the content, which changes through the day', () => {
    const at = (heading: string, body: string) =>
      morningParts({ title: 'x', date: '2026-10-31', sections: [{ heading, body }] });
    expect(at('Office · Evening Prayer', 'O gladsome light.')).toMatchObject({
      officeTitle: 'Evening Prayer',
      office: 'O gladsome light.',
    });
    expect(at('Compline', 'The Lord grant us a quiet night.')).toMatchObject({
      officeTitle: 'Compline',
    });
    expect(at('Office', '#### Evening Prayer\n\nO gladsome light.')).toMatchObject({
      officeTitle: 'Evening Prayer',
      office: 'O gladsome light.',
    });
    expect(at('Office', '#### Venite · Psalm 95\n\nO come.')).toMatchObject({
      officeTitle: 'Morning Prayer',
      office: '#### Venite · Psalm 95\n\nO come.',
    });
    expect(at('Office: midday prayer', 'Blessed be God.').officeTitle).toBe('Midday Prayer');
  });

  it('splits markdown into blocks and reads a row’s label', () => {
    expect(blocksOf('One.\nstill one.\n\n- a\n- b\n\n1. c')).toEqual([
      'One. still one.',
      'a',
      'b',
      'c',
    ]);
    expect(parseShapeRow('6:12 · Evening Prayer')).toEqual({
      label: '6:12',
      text: 'Evening Prayer',
    });
    expect(parseShapeRow('10:30 Carytown with Kelly')).toEqual({
      label: '10:30',
      text: 'Carytown with Kelly',
    });
    expect(parseShapeRow('Dinner · Chili · weeknight · 40 min')).toEqual({
      label: 'Dinner',
      text: 'Chili · weeknight · 40 min',
    });
    expect(parseShapeRow('Nothing on the calendar.')).toEqual({
      label: '',
      text: 'Nothing on the calendar.',
    });
    expect(dayHeading('2026-10-31')).toEqual({ weekday: 'Saturday', date: '31 October 2026' });
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
