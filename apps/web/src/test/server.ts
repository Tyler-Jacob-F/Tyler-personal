import { http, HttpResponse } from 'msw/http';
import { setupServer } from 'msw/node';

/** The shell asks who is signed in once; everything else is added per test with `server.use`. */
export const adminMe = {
  caller: { kind: 'member', id: '1b2c6a6e-3b6e-4b2e-9a6e-2c6a6e3b6e4b', role: 'admin' },
  email: 'tyler.fuqua@icloud.com',
  displayName: 'Tyler',
};

export const server = setupServer(http.get('/api/me', () => HttpResponse.json(adminMe)));
