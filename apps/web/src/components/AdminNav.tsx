import { NavLink, useLocation } from 'react-router';
import { ADMIN_PLACES, isActive } from '@/components/nav';
import { focusRing } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

/** The second row under Admin: Tokens, Activity, and the Stack page that explains the rest. */
export function AdminNav() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Admin" className="flex items-center gap-1">
      <span className="eyebrow mr-2">Admin</span>
      {ADMIN_PLACES.map((place) => {
        const active = isActive(place, pathname);
        return (
          <NavLink
            key={place.to}
            to={place.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-11 items-center rounded-md px-2 text-sm',
              focusRing,
              active ? 'font-semibold text-text-strong' : 'text-muted hover:text-text',
            )}
          >
            {place.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
