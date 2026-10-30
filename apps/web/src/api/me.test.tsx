import { http, HttpResponse } from 'msw/http';
import { useMe } from '@/api/me';
import { render, screen } from '@/test/render';
import { server } from '@/test/server';

function Me() {
  const me = useMe();
  if (me.isPending) return <p>loading</p>;
  if (me.isError) return <p role="alert">{me.error.message}</p>;
  const role = me.data.caller.kind === 'member' ? me.data.caller.role : 'agent';
  return (
    <p>
      {me.data.displayName} ({role})
    </p>
  );
}

describe('useMe', () => {
  it('fetches /api/me with the bearer token and parses the response', async () => {
    let authorization: string | null = null;
    server.use(
      http.get('/api/me', ({ request }) => {
        authorization = request.headers.get('authorization');
        return HttpResponse.json({
          caller: { kind: 'member', id: '9b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b', role: 'admin' },
          email: 'tyler.fuqua@icloud.com',
          displayName: 'Tyler',
        });
      }),
    );
    render(<Me />);
    expect(await screen.findByText('Tyler (admin)')).toBeInTheDocument();
    expect(authorization).toBe('Bearer test-id-token');
  });

  it('says so, readably, when the body does not fit the schema', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json({ caller: 'nobody' })));
    render(<Me />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /shape this page does not understand/,
    );
  });

  it('turns an API error body into a readable error', async () => {
    server.use(
      http.get('/api/me', () =>
        HttpResponse.json({ error: 'forbidden', message: 'not a member' }, { status: 403 }),
      ),
    );
    render(<Me />);
    expect(await screen.findByRole('alert')).toHaveTextContent('not a member');
  });
});
