import { MoonIcon, SunIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { focusRing } from '@/components/ui/styles';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/theme';

/**
 * Icon-only in the bar, with the action in its label: a sun on dark, a moon on paper. In
 * the phone sheet (docs/design/nav-open-*.png) it is a switch labelled "Paper".
 */
export function ThemeToggle({
  className,
  variant = 'icon',
}: {
  className?: string;
  variant?: 'icon' | 'switch';
}) {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  if (variant === 'switch') {
    const paper = theme === 'light';
    return (
      <button
        type="button"
        role="switch"
        aria-checked={paper}
        aria-label="Paper"
        className={cn(
          'inline-flex h-11 items-center gap-3 rounded-md text-[15px]',
          focusRing,
          className,
        )}
        onClick={toggle}
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative inline-block h-7 w-12 rounded-full border transition-colors',
            paper ? 'border-text-strong bg-text-strong' : 'border-border-strong bg-surface-raised',
          )}
        >
          <span
            className={cn(
              'absolute top-1 left-1 size-[18px] rounded-full transition-transform',
              paper ? 'translate-x-5 bg-bg' : 'bg-muted',
            )}
          />
        </span>
        Paper
      </button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={toggle}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
