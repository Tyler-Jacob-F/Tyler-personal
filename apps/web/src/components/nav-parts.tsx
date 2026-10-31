import { Link, NavLink, useLocation } from 'react-router';
import { isActive, type Place } from '@/components/nav';
import { focusRing } from '@/components/ui/styles';
import { cn } from '@/lib/utils';

/** A place in a top bar: strong when current, muted otherwise (docs/design/nav-*.png). */
export function PlaceLink({ place, pathname }: { place: Place; pathname: string }) {
  const active = isActive(place, pathname);
  return (
    <NavLink
      to={place.to}
      end={place.end}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-11 items-center rounded-md px-2 text-[15px] transition-colors',
        focusRing,
        active ? 'font-semibold text-text-strong' : 'text-muted hover:text-text',
      )}
    >
      {place.label}
    </NavLink>
  );
}

/** A place in the phone sheet: Literata for the main places, Source Sans for a sub-group, a hint at the right. */
export function SheetRow({
  place,
  pathname,
  serif = true,
}: {
  place: Place;
  pathname: string;
  serif?: boolean;
}) {
  const active = isActive(place, pathname);
  return (
    <li>
      <Link
        to={place.to}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-13 items-center justify-between gap-3',
          serif ? 'font-serif text-[19px]' : 'text-[17px]',
          focusRing,
          active ? 'font-semibold text-text-strong' : 'text-text',
        )}
      >
        {place.label}
        {place.hint && <span className="text-[13px] text-muted">{place.hint}</span>}
      </Link>
    </li>
  );
}

/** A second row of places under a top-bar place: Admin's three, the group's five. */
export function SubNav({ label, places }: { label: string; places: Place[] }) {
  const { pathname } = useLocation();
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1">
      <span className="eyebrow mr-2">{label}</span>
      {places.map((place) => {
        const active = isActive(place, pathname);
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
