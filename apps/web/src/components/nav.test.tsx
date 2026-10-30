import { http, HttpResponse } from 'msw/http';
import { App } from '@/App';
import { render, screen, userEvent, waitFor, within } from '@/test/render';
import { adminMe, server } from '@/test/server';

const noDocuments = () =>
  server.use(http.get('/api/documents', () => HttpResponse.json({ items: [] })));

describe('the top bar', () => {
  it('names the places, with Admin for the admin, and the actions of the contract', async () => {
    noDocuments();
    render(<App />, { route: '/recipes' });
    const places = screen.getByRole('navigation', { name: 'Places' });
    await waitFor(() =>
      expect(
        within(places)
          .getAllByRole('link')
          .map((a) => a.textContent),
      ).toEqual(['Home', 'Recipes', 'Writing', 'Group', 'Admin']),
    );
    expect(within(places).getByRole('link', { name: 'Recipes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(places).getByRole('link', { name: 'Admin' })).toHaveAttribute(
      'href',
      '/admin/tokens',
    );
    expect(screen.getByRole('link', { name: 'The Keep' })).toHaveAttribute('href', '/');
    expect(screen.getAllByRole('button', { name: 'Search' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: /New recipe/ })).toHaveAttribute(
      'href',
      '/recipes/new',
    );
    expect(
      screen.getByRole('button', { name: /Switch to (light|dark) theme/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument();
  });

  it('hides Admin from the group role', async () => {
    noDocuments();
    server.use(
      http.get('/api/me', () =>
        HttpResponse.json({ ...adminMe, caller: { ...adminMe.caller, role: 'group' } }),
      ),
    );
    render(<App />, { route: '/recipes' });
    const places = screen.getByRole('navigation', { name: 'Places' });
    await screen.findByText(/Nothing yet/);
    expect(within(places).queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(within(places).getAllByRole('link')).toHaveLength(4);
  });

  it('leads Writing and Group to a one-line page until their phases', async () => {
    const user = userEvent.setup();
    noDocuments();
    render(<App />, { route: '/recipes' });
    await user.click(screen.getByRole('link', { name: 'Writing' }));
    expect(await screen.findByRole('heading', { name: 'Writing' })).toBeInTheDocument();
    expect(screen.getByText(/Not yet\. Phase 5\./)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Group' }));
    expect(await screen.findByRole('heading', { name: 'Group' })).toBeInTheDocument();
    expect(screen.getByText(/Not yet\. Phase 4\./)).toBeInTheDocument();
  });

  it('opens search with ⌘K and with the search button: the Recipes field takes focus', async () => {
    const user = userEvent.setup();
    noDocuments();
    render(<App />, { route: '/writing' });
    await screen.findByRole('heading', { name: 'Writing' });
    await user.keyboard('{Meta>}k{/Meta}');
    const field = await screen.findByRole('searchbox', { name: 'Search recipes' });
    expect(field).toHaveFocus();
    await user.click(screen.getByRole('link', { name: 'Group' }));
    await screen.findByRole('heading', { name: 'Group' });
    await user.click(screen.getAllByRole('button', { name: 'Search' })[0]!);
    expect(await screen.findByRole('searchbox', { name: 'Search recipes' })).toHaveFocus();
  });

  it('splits New by type: the main button makes the current type, the caret lists them all', async () => {
    const user = userEvent.setup();
    noDocuments();
    render(<App />, { route: '/writing' });
    await screen.findByRole('heading', { name: 'Writing' });
    expect(screen.getByRole('link', { name: /New recipe/ })).toHaveAttribute(
      'href',
      '/recipes/new',
    );
    await user.click(screen.getByRole('button', { name: 'New…' }));
    const menu = screen.getByRole('menu', { name: 'New' });
    expect(within(menu).getByRole('menuitem', { name: 'New recipe' })).toHaveAttribute(
      'href',
      '/recipes/new',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('the phone sheet', () => {
  it('opens from the menu button with a search field at the top, lists the places, and closes on navigation', async () => {
    const user = userEvent.setup();
    noDocuments();
    render(<App />, { route: '/recipes' });
    await screen.findByText(/Nothing yet/);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Menu' });
    const field = within(sheet).getByRole('searchbox', { name: 'Search' });
    expect(field).toHaveFocus();
    expect(within(sheet).getByText('tyler.fuqua@icloud.com')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(
      within(within(sheet).getByRole('navigation', { name: 'Places' }))
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Home', 'Recipes', 'Writing', 'Group', 'Admin']);
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(within(sheet).getByRole('link', { name: 'Writing' }));
    await screen.findByRole('heading', { name: 'Writing' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('searches from the sheet, landing on Recipes with the query', async () => {
    const user = userEvent.setup();
    noDocuments();
    render(<App />, { route: '/writing' });
    await screen.findByRole('heading', { name: 'Writing' });
    await user.click(screen.getAllByRole('button', { name: 'Search' })[1]!);
    const sheet = screen.getByRole('dialog', { name: 'Menu' });
    await user.type(within(sheet).getByRole('searchbox', { name: 'Search' }), 'breakfast{Enter}');
    expect(await screen.findByRole('searchbox', { name: 'Search recipes' })).toHaveValue(
      'breakfast',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape and hands focus back to the menu button', async () => {
    const user = userEvent.setup();
    noDocuments();
    render(<App />, { route: '/recipes' });
    await screen.findByText(/Nothing yet/);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
  });
});
