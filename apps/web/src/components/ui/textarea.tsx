import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-24 w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-sm',
        'placeholder:text-muted focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-wrong',
        className,
      )}
      {...props}
    />
  );
}
