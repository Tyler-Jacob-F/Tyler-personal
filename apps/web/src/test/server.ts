import { setupServer } from 'msw/node';

/** Handlers are added per test with `server.use`; nothing is mocked by default. */
export const server = setupServer();
