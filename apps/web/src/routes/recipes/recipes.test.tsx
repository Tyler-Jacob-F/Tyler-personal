import { http, HttpResponse } from 'msw/http';
import { App } from '@/App';
import { chili, diff12, ids, recipeDoc, version1, version2 } from '@/test/fixtures';
import { render, screen, userEvent, waitFor, within } from '@/test/render';
import { server } from '@/test/server';

describe('RecipeList', () => {
  it('lists recipes with their current version and summary', async () => {
    server.use(
      http.get('/api/documents', ({ request }) => {
        expect(new URL(request.url).searchParams.get('type')).toBe('recipe');
        return HttpResponse.json({ items: [recipeDoc(version2)] });
      }),
    );
    render(<App />, { route: '/recipes' });
    const item = await screen.findByRole('link', { name: /Chili/ });
    expect(within(item).getByText('v2')).toBeInTheDocument();
    expect(within(item).getByText(/added smoked paprika/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New recipe' })).toHaveAttribute(
      'href',
      '/recipes/new',
    );
  });

  it('says so when there is nothing yet', async () => {
    server.use(http.get('/api/documents', () => HttpResponse.json({ items: [] })));
    render(<App />, { route: '/recipes' });
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
  });
});

describe('NewRecipe', () => {
  it('posts the recipe with validated frontmatter and goes to it', async () => {
    const user = userEvent.setup();
    let posted: unknown;
    server.use(
      http.post('/api/documents', async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(recipeDoc(), { status: 201 });
      }),
      http.get(`/api/documents/${ids.doc}`, () => HttpResponse.json(recipeDoc())),
    );
    render(<App />, { route: '/recipes/new' });
    await user.type(await screen.findByLabelText('Title'), 'Chili');
    await user.type(screen.getByLabelText('Serves'), '8');
    await user.type(screen.getByLabelText('Active minutes'), '20');
    await user.type(screen.getByLabelText('Total minutes'), '180');
    await user.selectOptions(screen.getByLabelText('Course'), 'main');
    await user.selectOptions(screen.getByLabelText('Main ingredient'), 'beef');
    await user.click(screen.getByRole('checkbox', { name: 'Kid-approved' }));
    await user.type(
      screen.getByLabelText('Ingredients'),
      '1 onion, diced\nMeats:\n2 lb ground chuck',
    );
    await user.type(screen.getByLabelText('Method'), '# Chili');
    await user.type(screen.getByLabelText('Written on'), '2023-11-06');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));

    await waitFor(() =>
      expect(posted).toEqual({
        type: 'recipe',
        frontmatter: {
          ...chili,
          ingredients: [
            { heading: null, items: ['1 onion, diced'] },
            { heading: 'Meats', items: ['2 lb ground chuck'] },
          ],
        },
        body: '# Chili',
        summary: '',
        tags: ['course:main', 'main:beef', 'flag:kid-approved'],
        authoredAt: '2023-11-06',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Chili', level: 1 })).toBeInTheDocument();
  });

  it('keeps the form on screen with messages when fields are wrong', async () => {
    const user = userEvent.setup();
    const post = vi.fn();
    server.use(http.post('/api/documents', post));
    render(<App />, { route: '/recipes/new' });
    await user.type(await screen.findByLabelText('Serves'), 'eight');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    expect(await screen.findByText(/whole number/)).toBeInTheDocument();
    expect(screen.getByText(/at least one ingredient/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('lets serves and the minutes stay blank and sends no numbers for them', async () => {
    const user = userEvent.setup();
    let posted: { frontmatter: Record<string, unknown>; authoredAt: unknown } | undefined;
    server.use(
      http.post('/api/documents', async ({ request }) => {
        posted = (await request.json()) as typeof posted;
        return HttpResponse.json(recipeDoc(), { status: 201 });
      }),
      http.get(`/api/documents/${ids.doc}`, () => HttpResponse.json(recipeDoc())),
    );
    render(<App />, { route: '/recipes/new' });
    await user.type(await screen.findByLabelText('Title'), 'Chili');
    await user.type(screen.getByLabelText('Ingredients'), 'salt');
    await user.click(screen.getByRole('button', { name: 'Save recipe' }));
    await waitFor(() => expect(posted).toBeDefined());
    expect(posted!.frontmatter).toEqual({
      title: 'Chili',
      ingredients: [{ heading: null, items: ['salt'] }],
    });
    expect(posted!.authoredAt).toBeNull();
  });
});

describe('RecipeDetail', () => {
  it('shows the current version with its details, ingredients and method', async () => {
    server.use(http.get(`/api/documents/${ids.doc}`, () => HttpResponse.json(recipeDoc(version2))));
    render(<App />, { route: `/recipes/${ids.doc}` });
    expect(await screen.findByRole('heading', { name: 'Chili', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/v2 · Tyler · written Jan 31, 2025 · entered/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Meats' })).toBeInTheDocument();
    expect(screen.getByText('1 tsp smoked paprika')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Chili', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Stir in smoked paprika/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/recipes/${ids.doc}/edit`,
    );
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      `/recipes/${ids.doc}/history`,
    );
  });

  it('shows the API error for a missing recipe', async () => {
    server.use(
      http.get(`/api/documents/${ids.doc}`, () =>
        HttpResponse.json({ error: 'not_found', message: 'document not found' }, { status: 404 }),
      ),
    );
    render(<App />, { route: `/recipes/${ids.doc}` });
    expect(await screen.findByRole('alert')).toHaveTextContent('document not found');
  });
});

describe('EditRecipe', () => {
  it('prefills from the current version and saves a new version with a summary', async () => {
    const user = userEvent.setup();
    let posted: unknown;
    let put: unknown;
    let current = recipeDoc(version1, ['course:main', 'camping']);
    server.use(
      http.get(`/api/documents/${ids.doc}`, () => HttpResponse.json(current)),
      http.post(`/api/documents/${ids.doc}/versions`, async ({ request }) => {
        posted = await request.json();
        current = recipeDoc(version2, current.document.tags);
        return HttpResponse.json(version2, { status: 201 });
      }),
      http.put(`/api/documents/${ids.doc}/tags`, async ({ request }) => {
        put = await request.json();
        current = recipeDoc(version2, (put as { tags: string[] }).tags);
        return HttpResponse.json(current);
      }),
    );
    render(<App />, { route: `/recipes/${ids.doc}/edit` });
    const ingredients = await screen.findByLabelText('Ingredients');
    expect(ingredients).toHaveValue('Meats:\n2 lb ground chuck\n1 onion, diced');
    expect(screen.getByLabelText('Total minutes')).toHaveValue('180');
    expect(screen.getByLabelText('Course')).toHaveValue('main');
    expect(screen.getByRole('checkbox', { name: 'Vegetarian' })).not.toBeChecked();

    await user.type(ingredients, '\n1 tsp smoked paprika');
    await user.type(screen.getByLabelText('Method'), 'Stir in smoked paprika.\n');
    await user.type(screen.getByLabelText('What changed'), 'added smoked paprika');
    await user.selectOptions(screen.getByLabelText('Season'), 'winter');
    await user.click(screen.getByRole('button', { name: 'Save as v2' }));

    await waitFor(() =>
      expect(posted).toEqual({
        frontmatter: {
          ...chili,
          ingredients: [
            {
              heading: 'Meats',
              items: ['2 lb ground chuck', '1 onion, diced', '1 tsp smoked paprika'],
            },
          ],
        },
        body: '# Chili\n\nBrown the beef.\nStir in smoked paprika.\n',
        summary: 'added smoked paprika',
        authoredAt: null,
      }),
    );
    await waitFor(() => expect(put).toEqual({ tags: ['course:main', 'season:winter', 'camping'] }));
    expect(await screen.findByText(/v2 · Tyler/)).toBeInTheDocument();
  });

  it('writes no tag change when the set is unchanged', async () => {
    const user = userEvent.setup();
    const put = vi.fn();
    server.use(
      http.get(`/api/documents/${ids.doc}`, () =>
        HttpResponse.json(recipeDoc(version1, ['course:main'])),
      ),
      http.post(`/api/documents/${ids.doc}/versions`, () =>
        HttpResponse.json(version2, { status: 201 }),
      ),
      http.put(`/api/documents/${ids.doc}/tags`, put),
    );
    render(<App />, { route: `/recipes/${ids.doc}/edit` });
    await user.type(await screen.findByLabelText('What changed'), 'nothing much');
    await user.click(screen.getByRole('button', { name: 'Save as v2' }));
    await screen.findByRole('heading', { name: 'Chili', level: 1 });
    expect(put).not.toHaveBeenCalled();
  });
});

describe('RecipeHistory', () => {
  it('lists versions newest first with diff links', async () => {
    server.use(
      http.get(`/api/documents/${ids.doc}`, () => HttpResponse.json(recipeDoc(version2))),
      http.get(`/api/documents/${ids.doc}/versions`, () =>
        HttpResponse.json({ items: [version2, version1] }),
      ),
    );
    render(<App />, { route: `/recipes/${ids.doc}/history` });
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('v2')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: 'Diff from v1' })).toHaveAttribute(
      'href',
      `/recipes/${ids.doc}/diff?from=1&to=2`,
    );
    expect(within(rows[1]!).queryByRole('link')).toBeNull();
    expect(screen.getByRole('link', { name: 'Compare latest two' })).toHaveAttribute(
      'href',
      `/recipes/${ids.doc}/diff?from=1&to=2`,
    );
  });
});

describe('RecipeDiff', () => {
  it('renders the unified body diff and the frontmatter changes', async () => {
    server.use(
      http.get(`/api/documents/${ids.doc}`, () => HttpResponse.json(recipeDoc(version2))),
      http.get(`/api/documents/${ids.doc}/diff`, ({ request }) => {
        const url = new URL(request.url);
        expect([url.searchParams.get('from'), url.searchParams.get('to')]).toEqual(['1', '2']);
        return HttpResponse.json(diff12);
      }),
    );
    render(<App />, { route: `/recipes/${ids.doc}/diff?from=1&to=2` });
    expect(await screen.findByText('v1 → v2')).toBeInTheDocument();
    expect(screen.getByText('+Stir in smoked paprika.')).toBeInTheDocument();
    expect(screen.queryByText(/^Index:/)).toBeNull();
    expect(screen.getByText('1 tsp smoked paprika')).toBeInTheDocument();
    expect(screen.queryByText('2 lb ground chuck')).toBeNull();
    expect(screen.getByText('No changes to the details.')).toBeInTheDocument();
  });

  it('asks for two versions when the query is missing', async () => {
    render(<App />, { route: `/recipes/${ids.doc}/diff` });
    expect(await screen.findByRole('alert')).toHaveTextContent('Pick two versions');
  });
});
