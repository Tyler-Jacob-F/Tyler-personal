import type { ComponentProps } from 'react';
import { fieldClasses } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn('flex min-h-28 py-2 leading-relaxed', fieldClasses, className)}
      {...props}
    />
  );
}
