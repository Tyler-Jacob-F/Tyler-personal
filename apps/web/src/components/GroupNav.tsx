import { NavLink, useLocation } from 'react-router';
import { focusRing } from '@/components/ui/styles';
import { GROUP_PLACES, groupPlaceActive } from '@/group/places';
import { cn } from '@/lib/utils';

/** The second row under Group for the admin, the way Admin has one: the group's five places. */
export function GroupNav() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Group" className="flex flex-wrap items-center gap-1">
      <span className="eyebrow mr-2">Group</span>
      {GROUP_PLACES.map((place) => {
        const active = groupPlaceActive(place, pathname);
        return (
          <NavLink
            key={place.to}
            to={place.to}
            end={place.end}
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
