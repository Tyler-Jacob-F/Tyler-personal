import { MoonIcon, SunIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/theme/theme';

/** Icon-only, with the action in its label: a sun on dark, a moon on paper. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
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
