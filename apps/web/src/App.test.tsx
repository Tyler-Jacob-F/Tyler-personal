import { App } from '@/App';
import { render, screen } from '@/test/render';

describe('App', () => {
  it('sends an anonymous visitor to sign in and remembers where they were going', async () => {
    render(<App />, { route: '/recipes', auth: { signedIn: false } });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('holds a protected route while a remembered session is restored', async () => {
    render(<App />, {
      route: '/recipes',
      auth: { signedIn: false, state: { status: 'restoring' } },
    });
    expect(await screen.findByText(/Signing you back in/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
  });

  it('shows the shell with the nav to a signed-in member', async () => {
    render(<App />, { route: '/' });
    expect(await screen.findByRole('link', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByText('tyler.fuqua@icloud.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
