import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'info' | 'danger';

const tones: Record<Tone, string> = {
  info: 'border-border bg-muted text-foreground',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
};

/** Composed from spec: a bordered message block with a tone. */
export function Alert({
  tone = 'info',
  className,
  ...props
}: ComponentProps<'div'> & { tone?: Tone }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-card border px-4 py-3 text-sm', tones[tone], className)}
      {...props}
    />
  );
}
