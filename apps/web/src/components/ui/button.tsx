import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';
import { focusRing } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

/**
 * docs/DESIGN-VALUES.md "Components": the default is outline (border-strong, transparent,
 * text); the single filled control on a page is `accent` with `on-accent` text. Ghost is
 * for the quiet actions beside them. Every size is 44px tall, the touch target the
 * contract asks for; `sm` only tightens the padding and type. Icon-only buttons must carry
 * an `aria-label`, which the type enforces.
 */
export type ButtonVariant = 'outline' | 'accent' | 'ghost';
type Size = 'default' | 'sm' | 'icon';

const variants: Record<ButtonVariant, string> = {
  outline:
    'border border-border-strong bg-transparent text-text hover:bg-surface active:bg-surface-raised',
  accent: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active',
  ghost: 'text-text hover:bg-surface active:bg-surface-raised',
};

const sizes: Record<Size, string> = {
  default: 'h-11 px-4 text-[15px]',
  sm: 'h-11 px-3 text-sm',
  icon: 'size-11 p-0',
};

type Common = Omit<ComponentProps<'button'>, 'aria-label'> & {
  variant?: ButtonVariant;
  asChild?: boolean;
};

export type ButtonProps =
  | (Common & { size?: 'default' | 'sm'; 'aria-label'?: string })
  | (Common & { size: 'icon'; 'aria-label': string });

export function Button({
  className,
  variant = 'outline',
  size = 'default',
  asChild,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors select-none',
        focusRing,
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
