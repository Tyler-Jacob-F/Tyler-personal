import { AuthError } from '@/auth/gateway';
import { SignIn } from '@/routes/SignIn';
import { render, screen, userEvent, waitFor } from '@/test/render';

describe('SignIn', () => {
  it('asks for an email, then the code, then signs in', async () => {
    const user = userEvent.setup();
    const requestCode = vi.fn(async (email: string) => ({ email, username: 'u', session: 's' }));
    const submitCode = vi.fn(async () => true);
    render(<SignIn />, { route: '/sign-in', auth: { signedIn: false, requestCode, submitCode } });

    await user.type(screen.getByLabelText('Email'), 'tyler.fuqua@icloud.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));

    expect(requestCode).toHaveBeenCalledWith('tyler.fuqua@icloud.com');
    expect(await screen.findByLabelText('Code')).toBeInTheDocument();
    expect(screen.getByText(/Sent to tyler.fuqua@icloud.com/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(submitCode).toHaveBeenCalledWith(
        { email: 'tyler.fuqua@icloud.com', username: 'u', session: 's' },
        '123456',
      ),
    );
  });

  it('prefills a remembered email so one click sends the code', async () => {
    const user = userEvent.setup();
    const requestCode = vi.fn(async (email: string) => ({ email, username: 'u', session: 's' }));
    render(<SignIn />, {
      route: '/sign-in',
      auth: { signedIn: false, rememberedEmail: 'tyler.fuqua@icloud.com', requestCode },
    });
    expect(screen.getByLabelText('Email')).toHaveValue('tyler.fuqua@icloud.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(requestCode).toHaveBeenCalledWith('tyler.fuqua@icloud.com');
  });

  it('waits quietly while a remembered session is restored', () => {
    render(<SignIn />, {
      route: '/sign-in',
      auth: { signedIn: false, state: { status: 'restoring' } },
    });
    expect(screen.getByText(/Signing you back in/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('validates the email and the code shape before calling anything', async () => {
    const user = userEvent.setup();
    const requestCode = vi.fn();
    render(<SignIn />, { route: '/sign-in', auth: { signedIn: false, requestCode } });
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(/allowlist/)).toBeInTheDocument();
    expect(requestCode).not.toHaveBeenCalled();
  });

  it('shows a wrong code inline and lets the user try again', async () => {
    const user = userEvent.setup();
    const submitCode = vi.fn(async () => false);
    render(<SignIn />, { route: '/sign-in', auth: { signedIn: false, submitCode } });
    await user.type(screen.getByLabelText('Email'), 'tyler.fuqua@icloud.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('Code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/not right/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('surfaces a gateway error and offers to start over', async () => {
    const user = userEvent.setup();
    const requestCode = vi.fn(async () => {
      throw new AuthError('rate_limited', 'Too many tries. Wait a minute and try again.');
    });
    render(<SignIn />, { route: '/sign-in', auth: { signedIn: false, requestCode } });
    await user.type(screen.getByLabelText('Email'), 'tyler.fuqua@icloud.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries');
  });
});
