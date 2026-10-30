import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';
import { focusRing } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

/**
 * docs/DESIGN-VALUES.md "Components": 1px `border`, radius `sm`, 13px `muted`; a selected
 * filter chip inverts to `text-strong` on `bg`. A chip is a span unless it does something,
 * in which case it is a real button (pressed state exposed) and its hit area is stretched
 * to the 44px target without changing how it looks.
 */
export interface ChipProps extends Omit<ComponentProps<'button'>, 'type'> {
  selected?: boolean;
  /** Render the child (a Link, say) as the chip. */
  asChild?: boolean;
}

export function Chip({ selected = false, asChild, className, onClick, ...props }: ChipProps) {
  const interactive = asChild || onClick !== undefined;
  const classes = cn(
    'inline-flex h-7 max-w-full items-center gap-1 rounded-sm border px-2 text-[13px] leading-none whitespace-nowrap',
    selected ? 'border-text-strong bg-text-strong text-bg' : 'border-border text-muted',
    interactive && [
      'relative cursor-pointer transition-colors',
      'before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[""]',
      selected ? 'hover:bg-text' : 'hover:border-border-strong hover:text-text',
      focusRing,
    ],
    className,
  );
  if (!interactive) {
    const { children } = props;
    return (
      <span data-slot="chip" data-selected={selected} className={classes}>
        {children}
      </span>
    );
  }
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="chip"
      data-selected={selected}
      type={asChild ? undefined : 'button'}
      aria-pressed={asChild ? undefined : selected}
      className={classes}
      onClick={onClick}
      {...props}
    />
  );
}
