import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'outline' | 'ghost' | 'destructive';
type Size = 'default' | 'sm';

const variants: Record<Variant, string> = {
  default: 'bg-foreground text-background hover:bg-foreground/90',
  outline: 'border border-border bg-background hover:bg-muted',
  ghost: 'hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

const sizes: Record<Size, string> = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 px-3 text-xs',
};

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

export function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control text-sm font-medium whitespace-nowrap transition-colors',
        'focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
