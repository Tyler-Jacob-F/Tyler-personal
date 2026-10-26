import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-9 w-full rounded-control border border-input bg-background px-3 py-1 text-sm',
        'placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
