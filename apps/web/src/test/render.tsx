import { render as rtlRender, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Custom render wrapper. Later phases inject QueryClient, router
 * and auth here so tests never assemble providers by hand.
 */
function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult {
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
