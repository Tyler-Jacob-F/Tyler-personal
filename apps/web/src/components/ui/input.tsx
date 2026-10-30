import type { ComponentProps } from 'react';
import { fieldClasses } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn('flex h-11 py-1', fieldClasses, className)}
      {...props}
    />
  );
}
