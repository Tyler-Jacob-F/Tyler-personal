import type { AgentToken } from '@the-keep/shared';
import { http, HttpResponse } from 'msw/http';
import { App } from '@/App';
import { tokens } from '@/test/fixtures';
import { render, screen, userEvent, waitFor, within } from '@/test/render';
import { server } from '@/test/server';

const secret = `keep_${'Q'.repeat(43)}`;

describe('TokensPage', () => {
  it('is reachable from the nav and lists tokens with scopes, last use and revocation', async () => {
    server.use(
      http.get('/api/admin/tokens', () =>
        HttpResponse.json({ items: [tokens.importer, tokens.cowork] }),
      ),
    );
    render(<App />, { route: '/admin/tokens' });
    expect(screen.getByRole('link', { name: 'Tokens' })).toHaveAttribute('href', '/admin/tokens');
    expect(
      await screen.findByRole('heading', { name: 'Agent tokens', level: 1 }),
    ).toBeInTheDocument();
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('importer')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('write:recipes')).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/last used/)).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/revoked/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/never used/)).toBeInTheDocument();
    expect(within(rows[1]!).queryByRole('button', { name: 'Revoke' })).toBeNull();
  });

  it('creates a token and shows the secret exactly once', async () => {
    const user = userEvent.setup();
    let posted: unknown;
    let items = [tokens.cowork];
    server.use(
      http.get('/api/admin/tokens', () => HttpResponse.json({ items })),
      http.post('/api/admin/tokens', async ({ request }) => {
        posted = await request.json();
        items = [tokens.importer, ...items];
        return HttpResponse.json({ token: tokens.importer, secret }, { status: 201 });
      }),
    );
    render(<App />, { route: '/admin/tokens' });
    await user.type(await screen.findByLabelText('Name'), 'importer');
    await user.click(screen.getByRole('checkbox', { name: /write:recipes/ }));
    await user.click(screen.getByRole('checkbox', { name: /read:documents/ }));
    await user.click(screen.getByRole('button', { name: 'Create token' }));

    await waitFor(() =>
      expect(posted).toEqual({ name: 'importer', scopes: ['read:documents', 'write:recipes'] }),
    );
    const panel = await screen.findByRole('region', { name: 'New token secret' });
    expect(within(panel).getByTestId('token-secret')).toHaveTextContent(secret);
    expect(screen.queryByRole('button', { name: 'Create token' })).toBeNull();

    await user.click(within(panel).getByRole('button', { name: 'Done, I have it' }));
    expect(screen.queryByText(secret)).toBeNull();
    expect(await screen.findByRole('button', { name: 'Create token' })).toBeInTheDocument();
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(document.body.textContent).not.toContain(secret);
  });

  it('refuses to submit without a name or a scope, without calling the API', async () => {
    const user = userEvent.setup();
    const post = vi.fn();
    server.use(
      http.get('/api/admin/tokens', () => HttpResponse.json({ items: [] })),
      http.post('/api/admin/tokens', post),
    );
    render(<App />, { route: '/admin/tokens' });
    await user.type(await screen.findByLabelText('Name'), 'Brief Writer');
    await user.click(screen.getByRole('button', { name: 'Create token' }));
    expect(await screen.findByText(/lowercase letters/)).toBeInTheDocument();
    expect(screen.getByText('Pick at least one scope.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('edits a token\u2019s scopes in place and shows the new set', async () => {
    const user = userEvent.setup();
    let items = [tokens.importer];
    let patched: unknown;
    server.use(
      http.get('/api/admin/tokens', () => HttpResponse.json({ items })),
      http.patch(`/api/admin/tokens/${tokens.importer.id}`, async ({ request }) => {
        patched = await request.json();
        const updated: AgentToken = {
          ...tokens.importer,
          scopes: ['read:documents', 'write:recipes', 'write:briefs'],
        };
        items = [updated];
        return HttpResponse.json(updated);
      }),
    );
    render(<App />, { route: '/admin/tokens' });
    await user.click(await screen.findByRole('button', { name: 'Edit scopes' }));
    const row = screen.getByRole('listitem');
    const briefs = within(row).getByRole('checkbox', { name: /write:briefs/ });
    expect(within(row).getByRole('checkbox', { name: /write:recipes/ })).toBeChecked();
    expect(briefs).not.toBeChecked();
    await user.click(briefs);
    await user.click(within(row).getByRole('button', { name: 'Save scopes' }));
    await waitFor(() =>
      expect(patched).toEqual({ scopes: ['read:documents', 'write:recipes', 'write:briefs'] }),
    );
    expect(
      await within(screen.getByRole('listitem')).findByText('write:briefs'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save scopes' })).toBeNull();
  });

  it('cannot save an empty scope set and can cancel an edit', async () => {
    const user = userEvent.setup();
    const patch = vi.fn();
    server.use(
      http.get('/api/admin/tokens', () => HttpResponse.json({ items: [tokens.importer] })),
      http.patch(`/api/admin/tokens/${tokens.importer.id}`, patch),
    );
    render(<App />, { route: '/admin/tokens' });
    await user.click(await screen.findByRole('button', { name: 'Edit scopes' }));
    const row = screen.getByRole('listitem');
    await user.click(within(row).getByRole('checkbox', { name: /read:documents/ }));
    await user.click(within(row).getByRole('checkbox', { name: /write:recipes/ }));
    expect(within(row).getByRole('button', { name: 'Save scopes' })).toBeDisabled();
    await user.click(within(row).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Edit scopes' })).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('revokes after confirmation', async () => {
    const user = userEvent.setup();
    let items = [tokens.importer];
    const revoked = vi.fn();
    server.use(
      http.get('/api/admin/tokens', () => HttpResponse.json({ items })),
      http.delete(`/api/admin/tokens/${tokens.importer.id}`, () => {
        revoked();
        items = [{ ...tokens.importer, revokedAt: '2026-10-30T14:00:00.000Z' }];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    render(<App />, { route: '/admin/tokens' });
    await user.click(await screen.findByRole('button', { name: 'Revoke' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Revoke importer?');
    await user.click(within(dialog).getByRole('button', { name: 'Back' }));
    expect(revoked).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, revoke' }),
    );
    await waitFor(() => expect(revoked).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/revoked/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
  });
});
