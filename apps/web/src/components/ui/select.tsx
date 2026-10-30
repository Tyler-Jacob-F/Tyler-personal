import type { ComponentProps } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { fieldClasses } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

/** The browser's own select, dressed like an Input: a real control on every phone. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <span className="relative block">
      <select
        data-slot="select"
        className={cn('h-11 appearance-none pr-9', fieldClasses, className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        width="16"
        height="16"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
    </span>
  );
}
