import { cn } from '@/lib/utils';

/** Every interactive element: reachable by Tab with a visible ring in `border-strong`. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

/** A hairline at rest, `border-strong` and a ring when focused, `wrong` when invalid. */
export const fieldClasses = cn(
  'w-full rounded-md border border-border bg-surface px-3 text-[15px] text-text',
  'placeholder:text-muted',
  'focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none',
  'aria-invalid:border-wrong disabled:cursor-not-allowed disabled:opacity-50',
);
