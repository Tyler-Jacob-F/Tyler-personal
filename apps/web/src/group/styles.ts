import { focusRing } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

/** A text link in the render's manner: underlined with a hairline, never the accent. */
export const quietLink = cn(
  'inline-flex min-h-11 items-center underline decoration-border-strong underline-offset-[3px] hover:text-text-strong',
  focusRing,
);
