import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { server } from '@/test/server';

// A cold CI runner can take more than Testing Library's one-second default to get a
// mocked fetch through react-query and back into the DOM. Five seconds is still a fast fail.
configure({ asyncUtilTimeout: 5_000 });

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
